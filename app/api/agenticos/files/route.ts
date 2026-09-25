import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export const runtime = 'nodejs'

function agentRoots(cwd: string): string[] {
  try {
    return fs
      .readdirSync(cwd, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.endsWith('-agent') && fs.existsSync(path.join(cwd, e.name, '.gitagent-meta.json')))
      .map((e) => path.join(cwd, e.name))
  } catch {
    return []
  }
}

function resolveSafe(rel: string): string | null {
  const cleaned = rel.replace(/^\/+/, '')
  if (!cleaned || cleaned.includes('..')) return null
  const cwd = process.cwd()
  const abs = path.resolve(cwd, cleaned)
  const allowed = agentRoots(cwd)
  if (!allowed.some((root) => abs === root || abs.startsWith(root + path.sep))) return null
  return abs
}

export async function GET(request: NextRequest) {
  const rel = request.nextUrl.searchParams.get('path') || ''
  const list = request.nextUrl.searchParams.get('list') === '1'
  const abs = resolveSafe(rel || (agentRoots(process.cwd())[0] ? path.relative(process.cwd(), agentRoots(process.cwd())[0]) : ''))
  if (!abs) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  if (!fs.existsSync(abs)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (list || fs.statSync(abs).isDirectory()) {
    const files: Array<{ path: string; type: 'file' | 'directory'; size: number }> = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') && entry.name !== '.gitagent-meta.json') continue
        const full = path.join(dir, entry.name)
        const relPath = path.relative(process.cwd(), full).split(path.sep).join('/')
        if (entry.isDirectory()) {
          files.push({ path: relPath, type: 'directory', size: 0 })
          walk(full)
        } else {
          files.push({ path: relPath, type: 'file', size: fs.statSync(full).size })
        }
      }
    }
    if (fs.statSync(abs).isDirectory()) walk(abs)
    else {
      files.push({
        path: path.relative(process.cwd(), abs).split(path.sep).join('/'),
        type: 'file',
        size: fs.statSync(abs).size,
      })
    }
    return NextResponse.json({ files })
  }

  const content = fs.readFileSync(abs, 'utf8')
  return NextResponse.json({
    path: path.relative(process.cwd(), abs).split(path.sep).join('/'),
    content,
    size: Buffer.byteLength(content),
  })
}
