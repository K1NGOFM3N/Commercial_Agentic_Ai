import { NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import type { ManifestAgent, ManifestKnowledge, ManifestSkill } from '@/lib/agenticos/types'

export const runtime = 'nodejs'

function listAgentDirs(cwd: string): string[] {
  try {
    return fs
      .readdirSync(cwd, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.endsWith('-agent') && fs.existsSync(path.join(cwd, e.name, '.gitagent-meta.json')))
      .map((e) => e.name)
  } catch {
    return []
  }
}

function readText(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function parseSkills(dir: string): ManifestSkill[] {
  const skillsDir = path.join(dir, 'skills')
  if (!fs.existsSync(skillsDir)) return []
  const out: ManifestSkill[] = []
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md')
    const content = readText(skillPath)
    const nameMatch = content.match(/^name:\s*(.+)$/m)
    const descMatch = content.match(/^description:\s*(.+)$/m)
    out.push({
      name: (nameMatch?.[1] || entry.name).trim(),
      description: (descMatch?.[1] || '').trim(),
      path: `${path.basename(dir)}/skills/${entry.name}/SKILL.md`,
    })
  }
  return out
}

function parseKnowledge(dir: string): ManifestKnowledge[] {
  const indexPath = path.join(dir, 'knowledge', 'index.yaml')
  const raw = readText(indexPath)
  if (!raw) return []
  const entries: ManifestKnowledge[] = []
  const blocks = raw.split(/\n(?=\s*-\s+path:)/)
  for (const block of blocks) {
    const pathMatch = block.match(/path:\s*(.+)/)
    if (!pathMatch) continue
    const tagsMatch = block.match(/tags:\s*\[([^\]]*)\]/)
    const tags = tagsMatch
      ? tagsMatch[1].split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
      : []
    entries.push({
      path: pathMatch[1].trim(),
      tags,
      priority: (block.match(/priority:\s*(\w+)/)?.[1] || 'medium').trim(),
      alwaysLoad: /always_load:\s*true/.test(block),
    })
  }
  return entries
}

function parseName(yaml: string, fallback: string) {
  return (yaml.match(/^name:\s*(.+)$/m)?.[1] || fallback).trim()
}

function parseDescription(yaml: string) {
  const folded = yaml.match(/description:\s*>\n((?:\s{2,}.+\n?)+)/)
  if (folded) return folded[1].split('\n').map((l) => l.trim()).join(' ').trim()
  return (yaml.match(/^description:\s*(.+)$/m)?.[1] || '').trim()
}

export async function GET() {
  const cwd = process.cwd()
  const agents: ManifestAgent[] = []
  for (const dirName of listAgentDirs(cwd)) {
    const dir = path.join(cwd, dirName)
    const slug = dirName.replace(/-agent$/, '')
    const yaml = readText(path.join(dir, 'agent.yaml'))
    agents.push({
      slug,
      name: parseName(yaml, slug),
      description: parseDescription(yaml),
      dir: dirName,
      skills: parseSkills(dir),
      knowledge: parseKnowledge(dir),
      soul: readText(path.join(dir, 'SOUL.md')).slice(0, 4000),
      rules: readText(path.join(dir, 'RULES.md')).slice(0, 4000),
      duties: readText(path.join(dir, 'DUTIES.md')).slice(0, 4000),
    })
  }
  return NextResponse.json({ agents, primary: agents[0] || null })
}
