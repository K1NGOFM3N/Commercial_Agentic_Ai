'use client'

import { useEffect, useState } from 'react'
import { Search, Wrench } from 'lucide-react'
import { fetchAgentFile } from '@/lib/agenticos/client'
import { Input } from '@/components/ui/input'
import { useAgenticos } from './os-shell'
import { renderMarkdown } from './markdown'

export function SkillsView() {
  const { agent } = useAgenticos()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState('')
  const [loading, setLoading] = useState(false)

  const skills = (agent?.skills || []).filter((s) => {
    const hay = `${s.name} ${s.description}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  useEffect(() => {
    if (!selected) return
    const skill = agent?.skills.find((s) => s.name === selected)
    if (!skill) return
    setLoading(true)
    fetchAgentFile(skill.path)
      .then((f) => setDetail(f.content))
      .catch(() => setDetail('Could not load this skill file.'))
      .finally(() => setLoading(false))
  }, [selected, agent])

  return (
    <div className="grid min-h-full grid-cols-1 md:grid-cols-[320px_1fr]">
      <aside className="border-r border-border/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h1 className="font-serif text-lg">Skills Manager</h1>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skills" />
        </div>
        <div className="space-y-1">
          {skills.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setSelected(s.name)}
              className={`w-full rounded-lg px-3 py-2 text-left ${selected === s.name ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
            >
              <p className="text-sm font-medium">{s.name}</p>
              <p className="line-clamp-2 text-[11px] text-muted-foreground">{s.description}</p>
            </button>
          ))}
          {skills.length === 0 && <p className="text-sm text-muted-foreground">No skills on this agent yet.</p>}
        </div>
      </aside>
      <section className="p-6">
        {!selected ? (
          <p className="text-sm text-muted-foreground">Select a skill to inspect its SKILL.md playbook.</p>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="prose-sm max-w-3xl">{renderMarkdown(detail)}</div>
        )}
      </section>
    </div>
  )
}
