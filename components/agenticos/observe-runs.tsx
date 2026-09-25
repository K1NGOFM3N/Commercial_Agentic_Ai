'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { loadRuns } from '@/lib/agenticos/client'
import type { AgentRun } from '@/lib/agenticos/types'
import { Badge } from '@/components/ui/badge'
import { useSampleData } from './sample-data'
import { useAgenticos } from './os-shell'

export function ObserveRuns() {
  const { journeys, agent } = useAgenticos()
  const { sampleDataEnabled } = useSampleData()
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    loadRuns()
      .then((r) => {
        if (r.items.length) {
          setRuns(r.items)
          setSelected(r.items[0].id)
          return
        }
        if (!sampleDataEnabled || !journeys[0]) return
        const demo: AgentRun = {
          id: 'demo-run',
          journey: journeys[0].title,
          status: 'completed',
          startedAt: 'sample',
          duration: '42s',
          trigger: 'Sample',
          model: 'anthropic:claude-sonnet-4-6',
          summary: 'Demonstration run. Execute a journey to record a live trace.',
          files: journeys[0].dataFiles || [],
          trace: [
            { id: 't1', label: `Loaded ${agent?.name || 'agent'}`, type: 'skill_load', detail: 'agent.yaml', timestamp: '' },
            { id: 't2', label: `Skill ${journeys[0].skill}`, type: 'skill_load', detail: `skills/${journeys[0].skill}/SKILL.md`, timestamp: '' },
          ],
        }
        setRuns([demo])
        setSelected(demo.id)
      })
      .catch(() => setRuns([]))
  }, [agent?.name, journeys, sampleDataEnabled])

  const current = runs.find((r) => r.id === selected) || null

  return (
    <div className="grid min-h-full grid-cols-1 md:grid-cols-[340px_1fr]">
      <aside className="border-r border-border/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h1 className="font-serif text-lg">Agent Runs</h1>
        </div>
        <div className="space-y-1">
          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => setSelected(run.id)}
              className={`w-full rounded-lg px-3 py-2 text-left ${selected === run.id ? 'bg-primary/10' : 'hover:bg-muted'}`}
            >
              <p className="text-sm font-medium">{run.journey}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{run.status} · {run.duration}</p>
            </button>
          ))}
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet. Use Run Agent on a journey.</p>}
        </div>
      </aside>
      <section className="space-y-4 p-6">
        {!current ? (
          <p className="text-sm text-muted-foreground">Select a run to inspect its trace.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl">{current.journey}</h2>
                <p className="text-sm text-muted-foreground">{current.summary}</p>
              </div>
              <Badge>{current.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-lg border border-border/60 p-3"><p className="text-[10px] uppercase text-muted-foreground">Duration</p><p className="font-mono">{current.duration}</p></div>
              <div className="rounded-lg border border-border/60 p-3"><p className="text-[10px] uppercase text-muted-foreground">Trigger</p><p>{current.trigger}</p></div>
              <div className="rounded-lg border border-border/60 p-3"><p className="text-[10px] uppercase text-muted-foreground">Model</p><p className="font-mono text-xs">{current.model}</p></div>
              <div className="rounded-lg border border-border/60 p-3"><p className="text-[10px] uppercase text-muted-foreground">Files</p><p className="font-mono">{current.files.length}</p></div>
            </div>
            <div className="space-y-2">
              {current.trace.map((t) => (
                <div key={t.id} className="rounded-xl border border-border/60 px-3 py-2">
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{t.type} {t.detail}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
