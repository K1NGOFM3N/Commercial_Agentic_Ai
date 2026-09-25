'use client'

/**
 * Git-Native Agent (GitAgentProtocol) Client Utility
 *
 * Client-side wrapper for calling git-native agents created by create_git_agent,
 * via the streaming /api/git-agent/chat route.
 * MUST be used from 'use client' components only — never from server components or server actions.
 *
 * Unlike callAIAgent (Lyzr agents — submit/poll a hosted task), a git agent
 * runs via a live SSE stream, so this resolves once the stream ends and
 * reports progress through callbacks rather than a single return value.
 *
 * The `slug` is exactly the value create_git_agent returned / that appears in
 * workflow_state.json (e.g. 'legal-office') — NOT the directory name. The
 * route appends '-agent' itself, so passing 'legal-office-agent' here would
 * look for a 'legal-office-agent-agent/' directory and fail.
 *
 * @example
 * ```tsx
 * import { streamGitAgent } from '@/lib/gitAgent'
 *
 * await streamGitAgent('Hello!', 'legal-office', {
 *   onDelta: (text) => setResponse((r) => r + text),
 *   onDone: () => setLoading(false),
 * })
 * ```
 */

import fetchWrapper from '@/lib/fetchWrapper'

export interface GitAgentToolEvent {
  type: string
  file?: string
  tool?: string
  skill?: string
  action?: string
  args?: Record<string, any>
  content?: string
  status?: string
}

export interface StreamGitAgentCallbacks {
  onDelta?: (text: string) => void
  onToolEvent?: (event: GitAgentToolEvent) => void
  onDone?: (data: { usage?: any; model?: string }) => void
  onError?: (message: string) => void
}

export interface StreamGitAgentOptions {
  sessionId?: string
  signal?: AbortSignal
}

const TOOL_EVENT_TYPES = new Set([
  'file_fetch',
  'file_write',
  'memory_update',
  'tool_use',
  'tool_result',
  'system_read',
])

/**
 * Stream a chat turn with a git-native agent. Resolves once the stream ends
 * (error or done) — use the callbacks for incremental UI updates as events
 * arrive.
 */
export async function streamGitAgent(
  message: string,
  slug: string,
  callbacks: StreamGitAgentCallbacks = {},
  options: StreamGitAgentOptions = {}
): Promise<void> {
  const { onDelta, onToolEvent, onDone, onError } = callbacks

  let response: Response | undefined
  try {
    response = await fetchWrapper('/api/git-agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, slug, sessionId: options.sessionId }),
      signal: options.signal,
    })
  } catch (error) {
    onError?.(error instanceof Error ? error.message : 'Network error')
    return
  }

  if (!response) {
    onError?.('No response from server')
    return
  }

  if (!response.ok || !response.body) {
    let detail = `Request failed with status ${response.status}`
    try {
      const data = await response.json()
      detail = data?.error || detail
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    onError?.(detail)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  // Wrapped so a mid-stream abort/network drop always reaches onError instead
  // of rejecting this promise — streamGitAgent's contract is "always resolves,
  // report status via callbacks," matching callAIAgent's error-as-value shape.
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || '' // Keep incomplete chunk in buffer

      for (const part of parts) {
        if (!part.trim()) continue

        let eventType = 'message'
        let dataLine = ''
        for (const line of part.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.slice('event:'.length).trim()
          } else if (line.startsWith('data:')) {
            dataLine = line.slice('data:'.length).trim()
          }
        }

        if (!dataLine) continue

        let data: any
        try {
          data = JSON.parse(dataLine)
        } catch {
          continue
        }

        if (eventType === 'delta' && typeof data.text === 'string') {
          onDelta?.(data.text)
        } else if (eventType === 'error') {
          onError?.(data.error || 'Agent error')
        } else if (eventType === 'done') {
          onDone?.({ usage: data.usage, model: data.model })
        } else if (TOOL_EVENT_TYPES.has(eventType)) {
          onToolEvent?.({ type: eventType, ...data })
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return // Caller-initiated abort (options.signal) — not an error to report.
    }
    onError?.(error instanceof Error ? error.message : 'Stream interrupted')
  }
}
