'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  BookOpen,
  ClipboardList,
  GitMerge,
  Home,
  Inbox,
  LayoutGrid,
  Network,
  Puzzle,
  Search,
  Shield,
  Sparkles,
  Workflow,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { agenticosConfig } from '@/lib/agenticos/config'
import { fetchManifest } from '@/lib/agenticos/client'
import type { JourneyDef, ManifestAgent } from '@/lib/agenticos/types'
import { SampleDataProvider, useSampleData } from './sample-data'

const ICON_MAP = {
  Home,
  Network,
  BookOpen,
  Wrench,
  Puzzle,
  Workflow,
  Inbox,
  LayoutGrid,
  Search,
  Shield,
  ClipboardList,
  GitMerge,
  Sparkles,
} as const

export function iconByName(name?: string) {
  if (name && name in ICON_MAP) return ICON_MAP[name as keyof typeof ICON_MAP]
  return Sparkles
}

function titleCase(slug: string) {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function resolveJourneys(agent: ManifestAgent | null): JourneyDef[] {
  if (!agenticosConfig.deriveJourneysFromSkills && agenticosConfig.journeys.length > 0) {
    return agenticosConfig.journeys
  }
  const fromConfig = agenticosConfig.journeys
  if (fromConfig.length > 0) return fromConfig
  return (agent?.skills || []).map((skill) => ({
    slug: skill.name,
    title: titleCase(skill.name),
    description: skill.description || `Run the ${titleCase(skill.name)} skill`,
    icon: 'Sparkles',
    skill: skill.name,
    cadence: 'On demand',
    sla: 'Interactive',
    nudges: [
      { label: 'Run this journey', prompt: `Run the ${skill.name} skill and summarize findings.` },
      { label: 'What data do you need?', prompt: `What knowledge files should I load for ${skill.name}?` },
      { label: 'Risks?', prompt: `What risks or exceptions should I watch for in ${skill.name}?` },
    ],
    metrics: [
      { label: 'Skill', value: skill.name, tone: 'primary' },
      { label: 'Status', value: 'Ready' },
    ],
    pendingActions: [],
    sections: [
      { id: 'intake', title: 'Intake & context', step: 'Load' },
      { id: 'analysis', title: 'Analysis', step: 'Reason' },
      { id: 'findings', title: 'Findings', step: 'Report' },
      { id: 'actions', title: 'Recommended actions', step: 'Act' },
    ],
  }))
}

export function useAgenticos() {
  const [agent, setAgent] = useState<ManifestAgent | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchManifest()
      .then((m) => {
        if (!cancelled) setAgent(m.primary)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const journeys = useMemo(() => resolveJourneys(agent), [agent])
  const appName = agenticosConfig.appName || agent?.name || 'AgenticOS'
  return { agent, journeys, appName, error }
}

type NavItem = { label: string; href: string; icon: keyof typeof ICON_MAP }

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/'
  const { sampleDataEnabled, setSampleDataEnabled } = useSampleData()
  const { agent, journeys, appName } = useAgenticos()

  const journeyItems: NavItem[] = journeys.map((j) => ({
    label: j.title,
    href: `/journeys/${j.slug}`,
    icon: (j.icon in ICON_MAP ? j.icon : 'GitMerge') as keyof typeof ICON_MAP,
  }))

  const sections: Array<{ header?: string; items: NavItem[] }> = [
    {
      items: [
        { label: 'Home', href: '/', icon: 'Home' },
        { label: 'LLM Wiki', href: '/wiki', icon: 'Network' },
      ],
    },
    { header: 'Agent Journeys', items: journeyItems },
    {
      header: 'Build',
      items: [
        { label: 'Skills Manager', href: '/skills', icon: 'Wrench' },
        { label: 'Knowledge Base', href: '/knowledge', icon: 'BookOpen' },
        { label: 'Integrations', href: '/integrations', icon: 'Puzzle' },
        { label: 'Skill Flows', href: '/skill-flows', icon: 'Workflow' },
      ],
    },
    {
      header: 'Observe',
      items: [
        { label: 'Decision Inbox', href: '/observe/inbox', icon: 'Inbox' },
        { label: 'Agent Metrics', href: '/observe/metrics', icon: 'LayoutGrid' },
        { label: 'Agent Runs', href: '/observe/runs', icon: 'Search' },
        { label: 'Compliance & Guardrails', href: '/observe/guardrails', icon: 'Shield' },
        { label: 'Audit Trail', href: '/observe/audit', icon: 'ClipboardList' },
      ],
    },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-background">
      <aside className="relative z-20 flex w-64 shrink-0 flex-col border-r border-border/60 bg-card">
        <div className="flex h-20 items-center gap-3 border-b border-border/60 px-5">
          <img src="/lyzr.png" alt="Lyzr" className="h-10 w-10 rounded-lg object-contain" />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-sm font-bold leading-tight tracking-tight text-foreground">
              {appName}
            </h1>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">
              {agenticosConfig.appSubtitle}
            </p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {sections.map((section, sIdx) => (
            <div key={section.header || `s-${sIdx}`} className={cn(sIdx > 0 && 'mt-1')}>
              {section.header ? (
                <div className="px-3 pb-1.5 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                    {section.header}
                  </span>
                </div>
              ) : sIdx > 0 ? (
                <div className="mx-2 my-2 h-px bg-border/60" />
              ) : null}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = ICON_MAP[item.icon] || Sparkles
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-3 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors',
                        active
                          ? 'border-primary/20 bg-primary/10 text-primary'
                          : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-border/60 p-3">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Sample Data</span>
            <button
              type="button"
              onClick={() => setSampleDataEnabled(!sampleDataEnabled)}
              className={cn(
                'relative h-5 w-9 rounded-full transition-colors',
                sampleDataEnabled ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
              title={sampleDataEnabled ? 'Showing sample data' : 'Showing live data only'}
            >
              <span
                className={cn(
                  'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform',
                  sampleDataEnabled && 'translate-x-4',
                )}
              />
            </button>
          </div>
          <Link
            href="/console"
            className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {agent?.name || 'Open agent console'}
          </Link>
        </div>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="min-h-full pr-16">{children}</div>
      </main>
    </div>
  )
}

export function OsShell({ children }: { children: ReactNode }) {
  return (
    <SampleDataProvider>
      <ShellInner>{children}</ShellInner>
    </SampleDataProvider>
  )
}
