'use client'

import { Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { agenticosConfig } from '@/lib/agenticos/config'
import { useAgenticos } from './os-shell'
import { renderMarkdown } from './markdown'

export function ObserveGuardrails() {
  const { agent } = useAgenticos()
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h1 className="font-serif text-2xl">Compliance & Guardrails</h1>
      </div>
      <div className="space-y-2">
        {agenticosConfig.guardrails.map((g) => (
          <div key={g.id} className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{g.name}</p>
              <div className="flex gap-2">
                <Badge variant="outline">{g.severity}</Badge>
                <Badge>{g.status}</Badge>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
          </div>
        ))}
      </div>
      {agent?.rules ? (
        <div className="rounded-2xl border border-border/60 p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">From RULES.md</h2>
          {renderMarkdown(agent.rules)}
        </div>
      ) : null}
    </div>
  )
}
