'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Mic,
  Plus,
  Send,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { agenticosConfig } from '@/lib/agenticos/config'
import { iconByName, useAgenticos } from './os-shell'
import { useSampleData } from './sample-data'
import type { Insight, PendingAction } from '@/lib/agenticos/types'

function severityIcon(sev: string) {
  if (sev === 'critical' || sev === 'warning') return AlertTriangle
  if (sev === 'success') return CheckCircle2
  return Info
}

function seedInsights(journeys: { title: string; slug: string }[]): Insight[] {
  if (agenticosConfig.insights.length) return agenticosConfig.insights
  return journeys.slice(0, 4).map((j, i) => ({
    id: `ins-${j.slug}`,
    severity: (['warning', 'info', 'critical', 'success'] as const)[i % 4],
    headline: `${j.title} needs a review`,
    summary: `The ${j.title} journey has new signals ready. Open it to run the agent and inspect findings.`,
    category: j.title,
    href: `/journeys/${j.slug}`,
  }))
}

function seedActions(journeys: { title: string; slug: string }[]): PendingAction[] {
  if (agenticosConfig.pendingActions.length) return agenticosConfig.pendingActions
  return journeys.slice(0, 3).map((j, i) => ({
    id: `pa-${j.slug}`,
    title: `Approve ${j.title} output`,
    description: `A draft conclusion is ready. Review the agent pipeline and sign off before anything is sent downstream.`,
    urgency: (['critical', 'warning', 'info'] as const)[i % 3],
    requester: 'Agent',
    dueDate: 'Today',
    category: j.title,
    href: `/observe/inbox`,
  }))
}

export function CommandCenter() {
  const router = useRouter()
  const { agent, journeys, appName } = useAgenticos()
  const { sampleDataEnabled } = useSampleData()
  const [query, setQuery] = useState('')
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [showAllActions, setShowAllActions] = useState(false)
  const [showAllInsights, setShowAllInsights] = useState(false)

  const insights = useMemo(
    () => (sampleDataEnabled ? seedInsights(journeys) : []),
    [journeys, sampleDataEnabled],
  )
  const actions = useMemo(
    () => (sampleDataEnabled ? seedActions(journeys).filter((a) => !dismissed.has(a.id)) : []),
    [journeys, sampleDataEnabled, dismissed],
  )

  const metrics = agenticosConfig.homeMetrics.map((m, idx) => {
    if (m.value !== '—') return m
    const derived = [
      String(journeys.length),
      String(actions.length),
      String(agent?.skills.length || 0),
      String(agent?.knowledge.length || 0),
    ]
    return { ...m, value: derived[idx] ?? m.value }
  })

  const shownActions = showAllActions ? actions : actions.slice(0, 3)
  const shownInsights = showAllInsights ? insights : insights.slice(0, 3)

  const submit = () => {
    if (!query.trim()) return
    router.push(`/console?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 p-6">
      <div className="flex flex-col items-center pb-8 pt-12 text-center">
        <img src="/lyzr.png" alt="Lyzr" className="mb-3 h-16 w-16 rounded-xl object-contain" />
        <h1 className="font-serif text-3xl tracking-tight text-foreground">
          {agenticosConfig.greeting}
          <span className="block italic text-primary">{appName}</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{agenticosConfig.tagline}</p>

        <div className="relative mt-6 w-full max-w-2xl">
          <Plus className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={agenticosConfig.searchPlaceholder}
            className="w-full rounded-2xl border border-border/60 bg-card py-3.5 pl-11 pr-24 text-sm shadow-sm outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <span className="rounded-lg p-2 text-muted-foreground/40">
              <Mic className="h-4 w-4" />
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!query.trim()}
              className="rounded-xl bg-primary p-2.5 text-primary-foreground shadow-sm disabled:opacity-30"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mb-2 mt-8 flex w-full items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">Agent Journeys</h2>
        </div>
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {journeys.map((card) => {
            const Icon = iconByName(card.icon)
            return (
              <Link
                key={card.slug}
                href={`/journeys/${card.slug}`}
                className="group flex items-center gap-3.5 rounded-xl border border-border/60 bg-card/70 px-4 py-3.5 text-left transition-all hover:border-primary/20 hover:bg-card hover:shadow-sm"
              >
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary">{card.title}</span>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{card.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            )
          })}
          {journeys.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
              No journeys yet. Create skills on the git-native agent, or set journeys in lib/agenticos/config.ts.
            </p>
          )}
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 md:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="bg-background p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{m.label}</p>
              <p className="font-serif text-3xl tabular-nums tracking-tight">{m.value}</p>
              {m.delta ? <p className="text-xs text-primary">{m.delta}</p> : null}
              {m.hint ? <p className="text-[11px] text-muted-foreground">{m.hint}</p> : null}
            </div>
          ))}
          {/* The container bg is the hairline colour; an unfilled grid cell would
              render as a solid slab of it, so pad partial rows with blank tiles. */}
          {Array.from({ length: (4 - (metrics.length % 4)) % 4 }, (_, i) => (
            <div key={`pad-${i}`} aria-hidden className="bg-background" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-xs font-semibold">Agent Insights</h2>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">{insights.length}</span>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card/50 p-1">
            {shownInsights.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {sampleDataEnabled ? 'No insights yet.' : 'Sample data is off. Run a journey to generate live insights.'}
              </p>
            ) : (
              shownInsights.map((insight, idx) => {
                const Icon = severityIcon(insight.severity)
                const inner = (
                  <div className={cn('flex items-start gap-2.5 rounded-xl px-2 py-2.5 hover:bg-background/80', idx !== 0 && 'border-t border-border/20')}>
                    <Icon className={cn('mt-0.5 h-4 w-4', insight.severity === 'critical' ? 'text-destructive' : insight.severity === 'warning' ? 'text-amber-600' : 'text-primary')} />
                    <div>
                      <p className="text-sm font-medium">{insight.headline}</p>
                      <p className="text-[12px] text-muted-foreground">{insight.summary}</p>
                    </div>
                  </div>
                )
                return insight.href ? <Link key={insight.id} href={insight.href}>{inner}</Link> : <div key={insight.id}>{inner}</div>
              })
            )}
            {insights.length > 3 && !showAllInsights ? (
              <button type="button" onClick={() => setShowAllInsights(true)} className="w-full py-2 text-xs text-primary">
                Show all
              </button>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-xs font-semibold">Actions required</h2>
          </div>
          <div className="space-y-2">
            {shownActions.length === 0 ? (
              <p className="rounded-xl border border-border/60 p-4 text-sm text-muted-foreground">
                {sampleDataEnabled ? 'Nothing waiting.' : 'Sample data is off. Approvals from live runs appear here and in Decision Inbox.'}
              </p>
            ) : (
              shownActions.map((action) => (
                <div key={action.id} className="rounded-xl border border-border/60 bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="text-[12px] text-muted-foreground">{action.description}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {action.category} · {action.dueDate}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => setDismissed((prev) => new Set(prev).add(action.id))}
                    >
                      Dismiss
                    </button>
                  </div>
                  <Link href={action.href || '/observe/inbox'} className="mt-2 inline-flex text-xs font-medium text-primary">
                    Review
                  </Link>
                </div>
              ))
            )}
            {actions.length > 3 && !showAllActions ? (
              <button type="button" onClick={() => setShowAllActions(true)} className="text-xs text-primary">
                Show all
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
