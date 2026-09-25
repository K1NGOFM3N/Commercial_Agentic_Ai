'use client'

import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { loadAudit } from '@/lib/agenticos/client'
import type { AuditEvent } from '@/lib/agenticos/types'
import { useSampleData } from './sample-data'

export function ObserveAudit() {
  const { sampleDataEnabled } = useSampleData()
  const [events, setEvents] = useState<AuditEvent[]>([])

  useEffect(() => {
    loadAudit()
      .then((r) => {
        if (r.items.length) {
          setEvents(r.items)
          return
        }
        if (!sampleDataEnabled) return
        setEvents([
          {
            id: 'seed-audit',
            ts: 'sample',
            actor: 'system',
            action: 'agenticos.ready',
            target: 'os',
            detail: 'AgenticOS scaffolded. Live audit events appear after you run journeys, flows, or connect integrations.',
          },
        ])
      })
      .catch(() => setEvents([]))
  }, [sampleDataEnabled])

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h1 className="font-serif text-2xl">Audit Trail</h1>
      </div>
      <div className="space-y-1">
        {events.map((e) => (
          <div key={e.id} className="grid grid-cols-1 gap-1 rounded-xl border border-border/60 px-3 py-2 text-sm md:grid-cols-[160px_120px_1fr]">
            <span className="font-mono text-[11px] text-muted-foreground">{e.ts}</span>
            <span className="font-medium">{e.action}</span>
            <span className="text-muted-foreground">{e.actor} · {e.target} · {e.detail}</span>
          </div>
        ))}
        {events.length === 0 && (
          <p className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
            No audit events yet. Running a journey, approving a decision, or connecting an integration writes a row here.
          </p>
        )}
      </div>
    </div>
  )
}
