'use client'

import { useEffect, useState } from 'react'
import { Inbox } from 'lucide-react'
import { appendAudit, loadInbox, saveInbox } from '@/lib/agenticos/client'
import type { DecisionItem } from '@/lib/agenticos/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSampleData } from './sample-data'
import { useAgenticos } from './os-shell'
import { renderMarkdown } from './markdown'

function seed(appName: string): DecisionItem[] {
  return [
    {
      id: 'seed-1',
      title: `First ${appName} sign-off`,
      summary: 'Sample decision so you can exercise approve / reject. Turn sample data off to see only live items.',
      status: 'pending',
      severity: 'warning',
      requestedBy: 'Agent',
      createdAt: 'sample',
      detail: 'This is demonstration data.',
    },
  ]
}

export function ObserveInbox() {
  const { appName, journeys } = useAgenticos()
  const { sampleDataEnabled } = useSampleData()
  const [items, setItems] = useState<DecisionItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    loadInbox()
      .then((r) => {
        const live = r.items
        setItems(sampleDataEnabled && live.length === 0 ? seed(appName) : live)
        setSelected((live[0] || seed(appName)[0])?.id || null)
      })
      .catch(() => setItems(sampleDataEnabled ? seed(appName) : []))
  }, [appName, sampleDataEnabled, journeys.length])

  const persist = async (next: DecisionItem[]) => {
    setItems(next)
    await saveInbox(next.filter((i) => i.createdAt !== 'sample'))
  }

  const decide = async (id: string, status: DecisionItem['status']) => {
    const next = items.map((i) => (i.id === id ? { ...i, status } : i))
    await persist(next)
    await appendAudit({
      id: `aud_${Date.now()}`,
      ts: new Date().toISOString(),
      actor: 'operator',
      action: `decision.${status}`,
      target: id,
      detail: status,
    })
  }

  const current = items.find((i) => i.id === selected) || null
  const counts = {
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    flagged: items.filter((i) => i.status === 'flagged').length,
  }

  return (
    <div className="grid min-h-full grid-cols-1 md:grid-cols-[340px_1fr]">
      <aside className="border-r border-border/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />
          <h1 className="font-serif text-lg">Decision Inbox</h1>
        </div>
        <div className="mb-3 grid grid-cols-4 gap-1 text-center text-[10px]">
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border/60 p-2">
              <p className="font-serif text-lg">{v}</p>
              <p className="uppercase text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.id)}
              className={`w-full rounded-lg px-3 py-2 text-left ${selected === item.id ? 'bg-primary/10' : 'hover:bg-muted'}`}
            >
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-[11px] text-muted-foreground">{item.status} · {item.severity}</p>
            </button>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">No decisions. Run a journey that needs approval.</p>}
        </div>
      </aside>
      <section className="p-6">
        {!current ? (
          <p className="text-sm text-muted-foreground">Select a decision.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl">{current.title}</h2>
                <p className="text-sm text-muted-foreground">{current.summary}</p>
                <div className="mt-2 flex gap-2">
                  <Badge>{current.status}</Badge>
                  <Badge variant="outline">{current.severity}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void decide(current.id, 'approved')}>Approve</Button>
                <Button variant="outline" onClick={() => void decide(current.id, 'flagged')}>Flag</Button>
                <Button variant="destructive" onClick={() => void decide(current.id, 'rejected')}>Reject</Button>
              </div>
            </div>
            {current.detail ? renderMarkdown(current.detail) : null}
          </div>
        )}
      </section>
    </div>
  )
}
