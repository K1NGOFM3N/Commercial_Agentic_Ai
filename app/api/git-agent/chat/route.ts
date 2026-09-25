import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// gitagent-wiring: v2 — do not remove; the platform upgrades this generated
// route in place when the marker version is older than its current template.
// GCMessage is declared locally (not imported from '@open-gitagent/gitagent')
// on purpose: a top-level `import type` from that package makes the bundler
// resolve the SDK's Node-only dependency graph (OpenTelemetry, node-cron, fs)
// into the build, producing "Can't resolve 'fs'" errors even though the SDK is
// only ever loaded through the dynamic import() below. This local shape matches
// exactly the fields this route reads off each streamed message.
type GCMessage = {
	type: string
	deltaType?: string
	content?: string
	toolName?: string
	args?: Record<string, any>
	isError?: boolean
	subtype?: string
	stopReason?: string
	usage?: unknown
	model?: string
}

/**
 * POST /api/git-agent/chat
 *
 * Streams a chat turn with a git-native (GitAgentProtocol) agent scaffolded
 * by create_git_agent at {slug}-agent/ inside this project. Ported from the
 * reference GitClaw integration pattern (query() -> SSE), swapped to
 * @open-gitagent/gitagent, the public package this app actually depends on.
 *
 * This is the git-agent counterpart to /api/agent (which handles Lyzr agents
 * via submit/poll). Git agents have no external hosted task queue and stream
 * live, so they get their own route rather than being forced into that JSON
 * contract — call it via streamGitAgent() from '@/lib/gitAgent', never a
 * custom fetch.
 */

// Requires Node's fs/child_process (via the SDK's builtin read/write/cli
// tools) — explicit so this never silently lands on an edge runtime.
export const runtime = 'nodejs'
// A multi-turn agent loop (maxTurns below) can run well past a typical
// serverless default timeout; only takes effect on platforms that read it
// (e.g. Vercel) — harmless elsewhere.
export const maxDuration = 300

// Git agents run through the SAME Lyzr account that powers this app's hosted
// Lyzr agents (callAIAgent): the platform provisions one dedicated "support"
// Lyzr agent per user (Anthropic / latest Sonnet) and gitagent's `lyzr:`
// model provider routes inference through it as an OpenAI-compatible
// endpoint, authenticated with the app's existing LYZR_API_KEY. No separate
// model API key is needed.
//
// Resolution order:
//   1. GIT_AGENT_MODEL — explicit full override ("provider:model[@base-url]"),
//      escape hatch for running outside the platform with e.g.
//      "anthropic:claude-sonnet-4-6" + ANTHROPIC_API_KEY.
//   2. lyzr:{GIT_AGENT_SUPPORT_AGENT_ID}@{LYZR_INFERENCE_URL} — the default
//      platform path.
const LYZR_INFERENCE_URL =
  process.env.GIT_AGENT_LYZR_URL || 'https://agent-prod.studio.lyzr.ai/v4'

function resolveModel(): { model: string; missing: string[] } {
  const override = process.env.GIT_AGENT_MODEL
  if (override) {
    const provider = override.split(':')[0]
    const keyEnv: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      google: 'GEMINI_API_KEY',
    }
    const required = keyEnv[provider]
    return {
      model: override,
      missing: required && !process.env[required] ? [required] : [],
    }
  }
  const missing: string[] = []
  if (!process.env.GIT_AGENT_SUPPORT_AGENT_ID) missing.push('GIT_AGENT_SUPPORT_AGENT_ID')
  if (!process.env.LYZR_API_KEY) missing.push('LYZR_API_KEY')
  return {
    model: `lyzr:${process.env.GIT_AGENT_SUPPORT_AGENT_ID}@${LYZR_INFERENCE_URL}`,
    missing,
  }
}

function sseLine(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function toolNameToEventType(toolName: string): string {
  switch (toolName) {
    case 'read':
      return 'file_fetch'
    case 'write':
      return 'file_write'
    case 'memory':
      return 'memory_update'
    case 'cli':
      return 'tool_use'
    default:
      return 'tool_use'
  }
}

function extractFileFromArgs(args: Record<string, any> | undefined): string {
  if (!args) return ''
  return args.file_path || args.path || args.file || ''
}

/**
 * A missing agent directory surfaces as ENOENT carrying the server's absolute
 * filesystem path — both from our own catch and from the SDK's system:error
 * events. Replace it with a clean, non-leaky message.
 */
function sanitizeAgentError(message: string, slug: string): string {
  if (/ENOENT|no such file or directory/i.test(message)) {
    return `Agent '${slug}' was not found in this app. Check the slug — it must match the value returned by create_git_agent.`
  }
  return message
}

/**
 * Serverless runtimes (Netlify/Vercel = AWS Lambda) mount the bundle at a
 * READ-ONLY path (/var/task), and the SDK writes runtime state
 * (.gitagent/state.json, memory) into the agent dir — running it from the
 * bundle throws EROFS. Copy the bundled dir to the writable tmpdir once per
 * cold start and run from there. A writable dir (the sandbox, self-hosted
 * containers) keeps running in place so the platform's sync engine still
 * sees memory updates. Deployed-runtime writes are ephemeral by design
 * (reset on cold start); durable memory lives in the sandbox and the
 * agent's own GitHub repo.
 */
const preparedAgentDirs = new Map<string, string>()

function isWritableDir(dir: string): boolean {
  try {
    fs.accessSync(dir, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function prepareAgentDir(slug: string): string {
  const bundled = path.join(process.cwd(), `${slug}-agent`)
  if (!fs.existsSync(bundled) || isWritableDir(bundled)) {
    return bundled // missing (surfaces as a clean not-found) or writable
  }
  const cached = preparedAgentDirs.get(slug)
  if (cached && fs.existsSync(cached)) return cached
  const dest = path.join(os.tmpdir(), 'git-agents', `${slug}-agent`)
  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(bundled, dest, { recursive: true })
  preparedAgentDirs.set(slug, dest)
  return dest
}

export async function POST(request: NextRequest) {
  let body: { message?: string; slug?: string; sessionId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, slug, sessionId } = body
  if (!message || !slug) {
    return NextResponse.json({ error: 'message and slug are required' }, { status: 400 })
  }

  // Path traversal guard — slug must be a plain directory-name segment.
  // Validated BEFORE any global env mutation below so a bad request can't
  // have side effects.
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })
  }

  const { model, missing } = resolveModel()
  if (missing.length > 0) {
    // 424 (Failed Dependency), NOT 503: the app's own fetch layer classifies
    // 503 as "sandbox/gateway unavailable" and routes it to the infra-retry
    // path, hiding this configuration error from the auto-fix loop. 424 is a
    // plain application error carrying missing_env.
    return NextResponse.json(
      {
        error: `Git agent is not configured: missing ${missing.join(', ')}. ` +
          `Add ${missing.join(' and ')} to this app's environment variables.`,
        missing_env: missing,
      },
      { status: 424 }
    )
  }

  // gitagent's `lyzr:` provider auths via pi-ai's OPENAI_API_KEY lookup (the
  // SDK flips unknown custom-endpoint providers to "openai"). Mirror the
  // official lyzr-sdk example: hand it the Lyzr key explicitly. Caveat: this
  // is process-global, so an app using a real OpenAI key alongside git
  // agents should set GIT_AGENT_MODEL instead of relying on the lyzr path.
  // SECURITY NOTE: an agent repo that sets model.model_override in its
  // config/*.yaml can outrank the model resolved here (the SDK's loader gives
  // envConfig.model_override top precedence). If that override names a real
  // provider, the Lyzr key set below would be sent to that provider's API.
  // Agents scaffolded by create_git_agent carry no such override; this only
  // matters for hand-edited repos, which the app owner controls.
  if (model.startsWith('lyzr:') && process.env.LYZR_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.LYZR_API_KEY
  }

  const agentDir = prepareAgentDir(slug)
  const encoder = new TextEncoder()
  const abortController = new AbortController()
  // Hoisted so cancel() (client disconnect) can stop the SDK directly — the
  // SDK does not currently honor abortController, so calling the stream's own
  // abort() is the only thing that actually halts the agent loop.
  let activeStream: { abort?: () => void } | null = null

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      let doneSent = false

      const write = (event: string, data: object) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(sseLine(event, data)))
        } catch {
          closed = true
        }
      }

      const writeDone = (data: object) => {
        if (doneSent) return
        doneSent = true
        write('done', data)
      }

      write('system_read', {
        file: `${slug}-agent/agent.yaml`,
        action: 'Loading agent...',
      })

      try {
        const { query } = await import('@open-gitagent/gitagent')

        // Always dir mode: the agent runs from its local {slug}-agent/
        // directory. The app repo does NOT track that directory — each agent
        // lives in its own GitHub repo. In the sandbox the platform's sync
        // engine keeps the dir present and current; in DEPLOYED apps
        // scripts/prebuild-git-agents.mjs clones each agent repo into the
        // checkout at build time (GIT_AGENT_REPOS / GIT_AGENT_REPO_TOKEN,
        // injected by the platform at deploy), so the bundle still freezes at
        // build time and no GitHub tokens are read at RUNTIME. When the
        // agent's repo changes later, the platform detects the drift on its
        // next sync and prompts a redeploy, which rebuilds with (and thus
        // ships) the repo's latest state.
        // No `constraints` here on purpose: the SDK REPLACES (not merges) the
        // manifest's model.constraints with whatever we pass, so passing
        // maxTokens alone would silently drop the agent.yaml temperature/etc.
        // that create_git_agent scaffolds. Let the manifest own tuning.
        const gcStream = query({
          prompt: message,
          dir: agentDir,
          model,
          sessionId: sessionId || undefined,
          abortController,
          maxTurns: 10,
        })
        activeStream = gcStream as unknown as { abort?: () => void }

        for await (const msg of gcStream as AsyncIterable<GCMessage>) {
          if (abortController.signal.aborted) break

          switch (msg.type) {
            case 'delta': {
              if (msg.deltaType === 'text') {
                write('delta', { text: msg.content })
              }
              break
            }

            case 'tool_use': {
              const eventType = toolNameToEventType(msg.toolName)
              const filePath = extractFileFromArgs(msg.args)
              write(eventType, {
                file: filePath || undefined,
                skill: msg.toolName,
                action: `${msg.toolName}(${filePath || JSON.stringify(msg.args).substring(0, 80)})`,
                tool: msg.toolName,
                args: msg.args,
              })
              break
            }

            case 'tool_result': {
              const eventType = msg.toolName === 'memory' ? 'memory_update' : 'tool_result'
              const preview = msg.content ? msg.content.substring(0, 300) : ''
              write(eventType, {
                tool: msg.toolName,
                status: msg.isError ? 'error' : 'loaded',
                content: preview,
                file: msg.toolName === 'memory' ? `${slug}-agent/memory/MEMORY.md` : undefined,
                action: msg.isError ? `Error: ${preview}` : `Loaded ${msg.toolName} result`,
              })
              break
            }

            case 'system': {
              // A hook_blocked turn ends with no assistant text — surface it
              // as an error so the client doesn't render an empty "success".
              if (msg.subtype === 'error' || msg.subtype === 'hook_blocked') {
                write('error', {
                  error: sanitizeAgentError(
                    msg.content || 'The agent blocked this request.',
                    slug,
                  ),
                })
              } else {
                write('system_read', { action: msg.content, file: `system:${msg.subtype}` })
              }
              break
            }

            case 'assistant': {
              if (msg.content && msg.stopReason !== 'toolUse') {
                writeDone({ finished: true, usage: msg.usage, model: msg.model })
                // 'done' must be the terminal event — stop reading so trailing
                // system:session_end frames don't arrive after it (clients
                // detach listeners on done).
                break
              }
              break
            }
          }

          if (doneSent) break
        }
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : 'Unknown error'
        write('error', { error: `Agent error: ${sanitizeAgentError(raw, slug)}` })
      }

      writeDone({ finished: true })
      if (!closed) {
        controller.close()
      }
    },
    cancel() {
      abortController.abort()
      try {
        activeStream?.abort?.()
      } catch {
        // best-effort — nothing more we can do on a disconnected client
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
