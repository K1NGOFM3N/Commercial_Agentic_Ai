'use client'

import { Check, Loader2, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PipelineStep = {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'error'
  detail?: string
}

export function AgentPipelineContent({ steps }: { steps: PipelineStep[] }) {
  if (steps.length === 0) return null
  return (
    <div className="space-y-1.5 rounded-xl border border-border/60 bg-card p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Agent pipeline</p>
      {steps.map((step) => (
        <div key={step.id} className="flex items-start gap-2 py-1 text-sm">
          {step.status === 'running' ? (
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
          ) : step.status === 'done' ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          ) : step.status === 'error' ? (
            <Square className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          ) : (
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-border/60" />
          )}
          <div className="min-w-0">
            <p className={cn('text-[13px]', step.status === 'pending' && 'text-muted-foreground')}>{step.label}</p>
            {step.detail ? <p className="truncate font-mono text-[11px] text-muted-foreground">{step.detail}</p> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function parseSections(text: string) {
  const blocks: Array<{ id: string; title: string; body: string }> = []
  const re = /\[SECTION(?:\s+id="([^"]+)")?\]\s*(?:#+\s*)?([^\n[]+)?([\s\S]*?)\[\/SECTION\]/gi
  let match: RegExpExecArray | null
  let i = 0
  while ((match = re.exec(text)) !== null) {
    i += 1
    const title = (match[2] || `Section ${i}`).trim()
    blocks.push({
      id: match[1] || `section-${i}`,
      title,
      body: (match[3] || '').trim(),
    })
  }
  return blocks
}
