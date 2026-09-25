import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// agenticos-wiki: v3 — do not remove; the platform upgrades this generated
// route in place when the marker version is older than its current template.

export const runtime = 'nodejs'

function primaryAgentDir(): string | null {
  const cwd = process.cwd()
  try {
    const hit = fs
      .readdirSync(cwd, { withFileTypes: true })
      .find((e) => e.isDirectory() && e.name.endsWith('-agent') && fs.existsSync(path.join(cwd, e.name, '.gitagent-meta.json')))
    return hit ? path.join(cwd, hit.name) : null
  } catch {
    return null
  }
}

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page'
}

function parseFrontmatter(raw: string) {
  if (!raw.startsWith('---')) return { meta: {} as Record<string, string>, body: raw }
  const end = raw.indexOf('\n---', 3)
  if (end < 0) return { meta: {} as Record<string, string>, body: raw }
  const fm = raw.slice(4, end)
  const body = raw.slice(end + 4).replace(/^\n/, '')
  const meta: Record<string, string> = {}
  for (const line of fm.split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return { meta, body }
}

/**
 * Wiki pages are agent memory: with a writable agent dir (the sandbox,
 * self-hosted containers) they are written in place so the platform's sync
 * engine ships them to the agent's own repo. Serverless runtimes
 * (Netlify/Vercel = AWS Lambda) mount the bundle at a READ-ONLY path, so
 * writes there go to a tmpdir copy of memory/wiki seeded once per cold
 * start — ephemeral by design, same as the chat route's agent-dir copy.
 */
const preparedWikiDirs = new Map<string, string>()

function isWritableDir(dir: string): boolean {
  try {
    fs.accessSync(dir, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function wikiDir(agentDir: string) {
  const inPlace = path.join(agentDir, 'memory', 'wiki')
  if (isWritableDir(agentDir)) {
    return inPlace
  }
  const cached = preparedWikiDirs.get(agentDir)
  if (cached && fs.existsSync(cached)) return cached
  const dest = path.join(os.tmpdir(), 'git-agents-wiki', path.basename(agentDir))
  fs.rmSync(dest, { recursive: true, force: true })
  fs.mkdirSync(dest, { recursive: true })
  if (fs.existsSync(inPlace)) {
    fs.cpSync(inPlace, dest, { recursive: true })
  }
  preparedWikiDirs.set(agentDir, dest)
  return dest
}

function readPages(agentDir: string) {
  const dir = wikiDir(agentDir)
  fs.mkdirSync(dir, { recursive: true })
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8')
    const { meta, body } = parseFrontmatter(raw)
    const slug = file.replace(/\.md$/, '')
    return {
      slug,
      title: meta.title || slug,
      type: (meta.type as 'entity' | 'concept' | 'synthesis') || 'concept',
      category: meta.category || 'general',
      updated: meta.updated || '',
      sources: (meta.sources || '').split(',').map((s) => s.trim()).filter(Boolean),
      tags: (meta.tags || '').split(',').map((s) => s.trim()).filter(Boolean),
      body,
      filePath: `${path.basename(agentDir)}/memory/wiki/${file}`,
    }
  })
}

function buildGraph(pages: ReturnType<typeof readPages>) {
  const nodes = pages.map((p) => ({
    id: p.slug,
    title: p.title,
    type: p.type,
    category: p.category,
    size: Math.min(28, 10 + Math.round(p.body.length / 200)),
  }))
  const ids = new Set(pages.map((p) => p.slug))
  const edges: Array<{ source: string; target: string }> = []
  for (const page of pages) {
    const re = /\[\[([^\]]+)\]\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(page.body)) !== null) {
      const target = slugify(m[1])
      if (ids.has(target) && target !== page.slug) edges.push({ source: page.slug, target })
    }
    for (const other of pages) {
      if (other.slug === page.slug) continue
      if (page.tags.some((t) => other.tags.includes(t))) {
        edges.push({ source: page.slug, target: other.slug })
      }
    }
  }
  const seen = new Set<string>()
  const dedup = edges.filter((e) => {
    const key = [e.source, e.target].sort().join('>')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { nodes, edges: dedup }
}

function seedIfEmpty(agentDir: string) {
  const dir = wikiDir(agentDir)
  fs.mkdirSync(dir, { recursive: true })
  if (fs.readdirSync(dir).some((f) => f.endsWith('.md'))) return
  const soul = fs.existsSync(path.join(agentDir, 'SOUL.md')) ? fs.readFileSync(path.join(agentDir, 'SOUL.md'), 'utf8') : ''
  const rules = fs.existsSync(path.join(agentDir, 'RULES.md')) ? fs.readFileSync(path.join(agentDir, 'RULES.md'), 'utf8') : ''
  const identity = `---
title: Agent identity
type: entity
category: core
tags: identity, soul
updated: seeded
---

# Agent identity

${soul.slice(0, 2500) || 'This wiki is seeded from the git-native agent directory.'}
`
  const guard = `---
title: Operating rules
type: concept
category: core
tags: rules, guardrails
updated: seeded
---

# Operating rules

See also [[Agent identity]].

${rules.slice(0, 2500) || 'Hard rules live in RULES.md in the agent repository.'}
`
  fs.writeFileSync(path.join(dir, 'agent-identity.md'), identity)
  fs.writeFileSync(path.join(dir, 'operating-rules.md'), guard)
}

export async function GET() {
  const agentDir = primaryAgentDir()
  if (!agentDir) return NextResponse.json({ pages: [], graph: { nodes: [], edges: [] } })
  seedIfEmpty(agentDir)
  const pages = readPages(agentDir)
  return NextResponse.json({ pages, graph: buildGraph(pages) })
}

export async function POST(request: NextRequest) {
  const agentDir = primaryAgentDir()
  if (!agentDir) return NextResponse.json({ error: 'No git agent found' }, { status: 404 })
  let body: { title?: string; body?: string; type?: string; category?: string; tags?: string[]; slug?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.title || !body.body) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }
  // slugify BOTH sources: body.slug is caller input and must never carry
  // path segments ("../SOUL") into the filename below.
  const slug = slugify(body.slug || body.title)
  const dir = wikiDir(agentDir)
  fs.mkdirSync(dir, { recursive: true })
  const tags = (body.tags || []).join(', ')
  const file = `---
title: ${body.title}
type: ${body.type || 'concept'}
category: ${body.category || 'general'}
tags: ${tags}
updated: now
---

${body.body}
`
  fs.writeFileSync(path.join(dir, `${slug}.md`), file)
  const pages = readPages(agentDir)
  const page = pages.find((p) => p.slug === slug)
  return NextResponse.json({ page })
}
