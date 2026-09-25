'use client'

import { useEffect, useState } from 'react'
import { Plug, RefreshCw } from 'lucide-react'
import { appendAudit, loadIntegrations, saveIntegrations } from '@/lib/agenticos/client'
import { agenticosConfig } from '@/lib/agenticos/config'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Conn = { id: string; connected: boolean; lastSync?: string }

export function IntegrationsView() {
  const [conns, setConns] = useState<Conn[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    loadIntegrations()
      .then((r) => setConns(r.items))
      .catch(() => setConns([]))
  }, [])

  const stateFor = (id: string) => conns.find((c) => c.id === id)

  const persist = async (next: Conn[]) => {
    setConns(next)
    await saveIntegrations(next)
  }

  const toggle = async (id: string, name: string) => {
    setBusy(id)
    try {
      const current = stateFor(id)
      const connected = !current?.connected
      const next: Conn = {
        id,
        connected,
        lastSync: connected ? new Date().toISOString() : undefined,
      }
      const merged = [...conns.filter((c) => c.id !== id), next]
      await persist(merged)
      await appendAudit({
        id: `aud_${Date.now()}`,
        ts: new Date().toISOString(),
        actor: 'operator',
        action: connected ? 'integration.connect' : 'integration.disconnect',
        target: id,
        detail: name,
      })
    } finally {
      setBusy(null)
    }
  }

  const cats = Array.from(new Set(agenticosConfig.integrations.map((i) => i.category)))

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Build</p>
        <h1 className="font-serif text-2xl">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect the systems this AgenticOS should read from and write to. Connection state is stored in this app.
        </p>
      </div>
      {cats.map((cat) => (
        <section key={cat}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h2>
          <div className="space-y-2">
            {agenticosConfig.integrations.filter((i) => i.category === cat).map((item) => {
              const st = stateFor(item.id)
              const connected = !!st?.connected
              return (
                <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Plug className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{item.name}</p>
                        <Badge variant={connected ? 'default' : 'secondary'}>{connected ? 'Connected' : 'Not connected'}</Badge>
                      </div>
                      <p className="mt-1 text-[12px] text-muted-foreground">{item.description}</p>
                      {connected && st?.lastSync ? (
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">Last sync {st.lastSync}</p>
                      ) : null}
                    </div>
                  </div>
                  <Button variant={connected ? 'outline' : 'default'} disabled={busy === item.id} onClick={() => void toggle(item.id, item.name)}>
                    {busy === item.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    {connected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
