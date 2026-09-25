import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// agenticos-store: v2 — do not remove; the platform upgrades this generated
// route in place when the marker version is older than its current template.
// The store lives under the OS tmpdir, never process.cwd(): serverless
// runtimes (Netlify/Vercel = AWS Lambda) mount the bundle at a READ-ONLY
// path, so a cwd store throws EROFS on every write — and in the sandbox a
// cwd store would risk auto-committing runtime state into the app repo.
// Ephemeral by design: it resets on cold start / instance recycle.

export const runtime = 'nodejs'

const ALLOWED = new Set(['flows', 'integrations', 'inbox', 'runs', 'audit'])

function storeDir() {
  return path.join(os.tmpdir(), 'agenticos-store')
}

function storePath(collection: string) {
  return path.join(storeDir(), `${collection}.json`)
}

function readItems(collection: string): unknown[] {
  const file = storePath(collection)
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeItems(collection: string, items: unknown[]) {
  fs.mkdirSync(storeDir(), { recursive: true })
  fs.writeFileSync(storePath(collection), JSON.stringify(items, null, 2))
}

export async function GET(request: NextRequest) {
  const collection = request.nextUrl.searchParams.get('collection') || ''
  if (!ALLOWED.has(collection)) {
    return NextResponse.json({ error: 'Unknown collection' }, { status: 400 })
  }
  return NextResponse.json({ items: readItems(collection) })
}

export async function PUT(request: NextRequest) {
  let body: { collection?: string; items?: unknown[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.collection || !ALLOWED.has(body.collection) || !Array.isArray(body.items)) {
    return NextResponse.json({ error: 'collection and items[] required' }, { status: 400 })
  }
  writeItems(body.collection, body.items)
  return NextResponse.json({ items: body.items })
}

export async function POST(request: NextRequest) {
  let body: { collection?: string; item?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.collection || !ALLOWED.has(body.collection) || body.item == null) {
    return NextResponse.json({ error: 'collection and item required' }, { status: 400 })
  }
  const items = readItems(body.collection)
  items.unshift(body.item)
  writeItems(body.collection, items.slice(0, 200))
  return NextResponse.json({ items })
}
