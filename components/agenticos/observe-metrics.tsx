'use client'

import { useEffect, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { loadInbox, loadRuns } from '@/lib/agenticos/client'
import type { AgentRun, DecisionItem } from '@/lib/agenticos/types'
import { useAgenticos } from './os-shell'
import { useSampleData } from './sample-data'

export function ObserveMetrics() {
  const { agent, journeys } = useAgenticos()
  const { sampleDataEnabled } = useSampleData()
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [inbox, setInbox] = useState<DecisionItem[]>([])

  useEffect(() => {
    Promise.all([loadRuns(), loadInbox()])
      .then(([r, i]) => {
        setRuns(r.items)
        setInbox(i.items)
      })
      .catch(() => {
        setRuns([])
        setInbox([])
      })
  }, [])

  const completed = runs.filter((r) => r.status === 'completed').length
  const failed = runs.filter((r) => r.status === 'failed').length
  const pending = inbox.filter((i) => i.status === 'pending').length

  const cards = [
    { label: 'Journeys', value: String(journeys.length) },
    { label: 'Skills', value: String(agent?.skills.length || 0) },
    { label: 'Knowledge files', value: String(agent?.knowledge.length || 0) },
    { label: 'Completed runs', value: String(completed || (sampleDataEnabled ? journeys.length : 0)) },
    { label: 'Failed runs', value: String(failed) },
    { label: 'Open decisions', value: String(pending || (sampleDataEnabled ? 1 : 0)) },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-primary" />
        <h1 className="font-serif text-2xl">Agent Metrics</h1>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-background p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{c.label}</p>
            <p className="font-serif text-4xl tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border/60 p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide">Runs by journey</h2>
        <div className="space-y-2">
          {journeys.map((j) => {
            const n = runs.filter((r) => r.journey === j.title).length
            const width = Math.max(8, Math.min(100, (n || (sampleDataEnabled ? 1 : 0)) * 20))
            return (
              <div key={j.slug} className="grid grid-cols-[160px_1fr_40px] items-center gap-3 text-sm">
                <span className="truncate">{j.title}</span>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${width}%` }} />
                </div>
                <span className="font-mono tabular-nums text-muted-foreground">{n}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
