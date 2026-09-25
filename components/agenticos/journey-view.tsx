'use client'

import { useMemo, useRef, useState } from 'react'
import { Loader2, Play, Send, Square } from 'lucide-react'
import { streamGitAgent } from '@/lib/gitAgent'
import { appendAudit, appendStore, loadInbox } from '@/lib/agenticos/client'
import type { DecisionItem, JourneyDef } from '@/lib/agenticos/types'
import { useAgenticos } from './os-shell'
import { useSampleData } from './sample-data'
import { AgentPipelineContent, parseSections, type PipelineStep } from './pipeline'
import { renderMarkdown } from './markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

function sectionPrompt(journey: JourneyDef) {
  const names = journey.sections.map((s, i) => `${i + 1}. [SECTION id="${s.id}"]${s.title}[/SECTION]`).join('\n')
  return [
    `You are running the "${journey.title}" journey using the "${journey.skill}" skill.`,
    'Load the matching skill and any tagged knowledge files before answering.',
    'Return structured analysis using these exact section wrappers:',
    names,
    'Inside each section: a one-line status (healthy/warning/critical), 3-6 short metrics, then markdown detail.',
    'Cite files you read. Do not invent numbers — label estimates explicitly.',
  ].join('\n')
}

export function JourneyView({ slug }: { slug: string }) {
  const { agent, journeys } = useAgenticos()
  const { sampleDataEnabled } = useSampleData()
  const journey = useMemo(() => journeys.find((j) => j.slug === slug), [journeys, slug])
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [chat, setChat] = useState('')
  const [chatLog, setChatLog] = useState<Array<{ role: 'user' | 'agent'; text: string }>>([])
  const abortRef = useRef<AbortController | null>(null)

  if (!journey) {
    return (
      <div className="p-8">
        <h1 className="font-serif text-2xl">Journey not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">No journey named “{slug}”. Check lib/agenticos/config.ts or the agent skills.</p>
      </div>
    )
  }

  const actions = sampleDataEnabled ? journey.pendingActions : []
  const sections = parseSections(output)

  const pushStep = (step: PipelineStep) => {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === step.id)
      if (idx === -1) return [...prev, step]
      const next = [...prev]
      next[idx] = { ...next[idx], ...step }
      return next
    })
  }

  const run = async (prompt: string, kind: 'analyze' | 'chat') => {
    if (!agent?.slug) {
      setError('No git-native agent is available yet.')
      return
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setRunning(true)
    setError('')
    if (kind === 'analyze') {
      setOutput('')
      setSteps([
        { id: 'cfg', label: 'Loading agent config', status: 'running' },
        { id: 'skill', label: `Loading skill ${journey.skill}`, status: 'pending' },
        { id: 'run', label: 'Running analysis', status: 'pending' },
      ])
    }
    let acc = ''
    const started = Date.now()
    try {
      await streamGitAgent(
        kind === 'analyze' ? `${sectionPrompt(journey)}\n\nUser request: ${prompt}` : `[Journey: ${journey.title}]\n${prompt}`,
        agent.slug,
        {
          onDelta: (text) => {
            acc += text
            if (kind === 'analyze') setOutput(acc)
            else setChatLog((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last?.role === 'agent') last.text = acc
              else next.push({ role: 'agent', text: acc })
              return next
            })
            pushStep({ id: 'cfg', label: 'Loading agent config', status: 'done' })
            pushStep({ id: 'skill', label: `Loading skill ${journey.skill}`, status: 'done' })
            pushStep({ id: 'run', label: 'Running analysis', status: 'running' })
          },
          onToolEvent: (e) => {
            pushStep({
              id: e.file || e.tool || e.type,
              label: e.action || e.type,
              status: 'done',
              detail: e.file,
            })
          },
          onDone: () => {
            pushStep({ id: 'run', label: 'Running analysis', status: 'done' })
          },
          onError: (msg) => setError(msg),
        },
        { signal: ac.signal },
      )
      if (kind === 'analyze') {
        const runId = `run_${started}`
        await appendStore('runs', {
          id: runId,
          journey: journey.title,
          status: 'completed',
          startedAt: new Date(started).toISOString(),
          duration: `${Math.max(1, Math.round((Date.now() - started) / 1000))}s`,
          trigger: 'User — Journey Run',
          model: 'anthropic:claude-sonnet-4-6',
          summary: acc.slice(0, 400),
          files: steps.map((s) => s.detail).filter(Boolean),
          trace: steps.map((s) => ({ id: s.id, label: s.label, type: 'tool_call', detail: s.detail || '', timestamp: '' })),
        })
        await appendAudit({
          id: `aud_${started}`,
          ts: new Date().toISOString(),
          actor: 'operator',
          action: 'journey.run',
          target: journey.slug,
          detail: `${journey.title} completed`,
        })
        const needsReview = /critical|approval|sign-off|escalate/i.test(acc)
        if (needsReview) {
          const inbox = await loadInbox()
          const item: DecisionItem = {
            id: `dec_${started}`,
            title: `${journey.title} needs review`,
            summary: acc.slice(0, 240) || 'The agent flagged this run for human review.',
            status: 'pending',
            severity: 'warning',
            journey: journey.title,
            requestedBy: agent.name,
            createdAt: new Date().toISOString(),
            detail: acc,
          }
          await appendStore('inbox', item)
          void inbox
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-4 p-6 pb-40">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Agent journey</p>
          <h1 className="font-serif text-2xl tracking-tight">{journey.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{journey.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {journey.cadence ? <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px]">{journey.cadence}</span> : null}
            {journey.sla ? <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px]">SLA · {journey.sla}</span> : null}
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">Skill · {journey.skill}</span>
          </div>
        </div>
        <Button onClick={() => run(`Run the ${journey.title} journey end to end.`, 'analyze')} disabled={running}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? 'Running…' : 'Run Agent'}
        </Button>
      </div>

      {actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((a) => (
            <div key={a.id} className="rounded-xl border border-border/60 bg-card px-3 py-2 text-sm">
              <span className="mr-2 font-mono text-[10px] uppercase text-primary">{a.urgency}</span>
              {a.title}
            </div>
          ))}
        </div>
      )}

      {journey.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 md:grid-cols-4">
          {journey.metrics.map((m) => (
            <div key={m.label} className="bg-background p-3">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className="font-serif text-2xl tabular-nums">{sampleDataEnabled || m.value !== '—' ? m.value : '—'}</p>
              {m.hint ? <p className="text-[11px] text-muted-foreground">{m.hint}</p> : null}
            </div>
          ))}
          {/* The container bg is the hairline colour; an unfilled grid cell would
              render as a solid slab of it, so pad partial rows with blank tiles. */}
          {Array.from({ length: (4 - (journey.metrics.length % 4)) % 4 }, (_, i) => (
            <div key={`pad-${i}`} aria-hidden className="bg-background" />
          ))}
        </div>
      )}

      {steps.length > 0 && <AgentPipelineContent steps={steps} />}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {sections.length > 0 ? (
        <div className="space-y-3">
          {sections.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border/60 bg-card p-4">
              <h3 className="text-sm font-semibold">{s.title}</h3>
              <div className="mt-2">{renderMarkdown(s.body)}</div>
            </div>
          ))}
        </div>
      ) : output ? (
        <div className="rounded-2xl border border-border/60 bg-card p-4">{renderMarkdown(output)}</div>
      ) : null}

      <div className="fixed bottom-0 left-64 right-0 z-10 border-t border-border/60 bg-background/95 p-3 pr-16 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {journey.nudges.map((n) => (
              <button
                key={n.label}
                type="button"
                className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted"
                onClick={() => {
                  setChatLog((prev) => [...prev, { role: 'user', text: n.prompt }])
                  void run(n.prompt, 'chat')
                }}
              >
                {n.label}
              </button>
            ))}
          </div>
          {chatLog.length > 0 && (
            <div className="max-h-32 overflow-y-auto text-sm">
              {chatLog.slice(-4).map((m, i) => (
                <p key={i} className={m.role === 'user' ? 'text-muted-foreground' : 'text-foreground'}>
                  <span className="font-medium">{m.role === 'user' ? 'You' : 'Agent'}: </span>
                  {m.text.slice(0, 280)}
                </p>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={chat}
              onChange={(e) => setChat(e.target.value)}
              placeholder={`Ask about ${journey.title}…`}
              className="min-h-[44px] resize-none"
            />
            {running ? (
              <Button variant="destructive" onClick={() => abortRef.current?.abort()}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (!chat.trim()) return
                  const msg = chat.trim()
                  setChat('')
                  setChatLog((prev) => [...prev, { role: 'user', text: msg }])
                  void run(msg, 'chat')
                }}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
