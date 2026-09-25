'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Play, Plus, Trash2, Workflow } from 'lucide-react'
import { streamGitAgent } from '@/lib/gitAgent'
import { appendAudit, loadFlows, saveFlows } from '@/lib/agenticos/client'
import type { SkillFlow, SkillFlowStep } from '@/lib/agenticos/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAgenticos } from './os-shell'
import { useSampleData } from './sample-data'
import { renderMarkdown } from './markdown'

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function FlowsView() {
  const { agent, journeys } = useAgenticos()
  const { sampleDataEnabled } = useSampleData()
  const [flows, setFlows] = useState<SkillFlow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState('')

  useEffect(() => {
    loadFlows()
      .then((r) => {
        if (r.items.length) {
          setFlows(r.items)
          setSelected(r.items[0].id)
          return
        }
        if (!sampleDataEnabled || journeys.length === 0) return
        const seed: SkillFlow = {
          id: 'flow-primary',
          name: `${journeys[0].title} suite`,
          description: `Chains the core skills for ${journeys[0].title}.`,
          status: 'active',
          steps: [
            { id: 's1', label: 'Load context', type: 'skill', skill: journeys[0].skill, promptTemplate: `Load files for ${journeys[0].title}` },
            { id: 's2', label: 'Analyze', type: 'skill', skill: journeys[0].skill, promptTemplate: `Analyze ${journeys[0].title}` },
            { id: 'gate', label: 'Human review', type: 'approval_gate', promptTemplate: 'Pause for operator approval' },
            { id: 's3', label: 'Notify', type: 'notification', promptTemplate: 'Summarize outcome' },
          ],
          history: [],
        }
        setFlows([seed])
        setSelected(seed.id)
        void saveFlows([seed])
      })
      .catch(() => setFlows([]))
  }, [journeys, sampleDataEnabled])

  const flow = flows.find((f) => f.id === selected) || null
  const skillOptions = useMemo(
    () => (agent?.skills || []).map((s) => s.name),
    [agent],
  )

  const persist = async (next: SkillFlow[]) => {
    setFlows(next)
    await saveFlows(next)
  }

  const updateFlow = (patch: Partial<SkillFlow>) => {
    if (!flow) return
    void persist(flows.map((f) => (f.id === flow.id ? { ...f, ...patch } : f)))
  }

  const addFlow = () => {
    const created: SkillFlow = {
      id: newId('flow'),
      name: 'New skill flow',
      description: 'Compose skills, gates, and notifications.',
      status: 'draft',
      steps: [{ id: newId('s'), label: 'First step', type: 'skill', skill: skillOptions[0], promptTemplate: 'Describe the work' }],
      history: [],
    }
    void persist([created, ...flows])
    setSelected(created.id)
  }

  const runFlow = async () => {
    if (!flow || !agent?.slug) return
    setRunning(true)
    setLog('')
    const started = Date.now()
    let completed = 0
    let accAll = ''
    const steps: SkillFlowStep[] = flow.steps.map((s) => ({ ...s, status: 'idle', outputPreview: '' }))
    try {
      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i]
        step.status = 'running'
        updateFlow({ steps: [...steps] })
        if (step.type === 'approval_gate') {
          step.status = 'done'
          step.outputPreview = 'Queued in Decision Inbox'
          completed += 1
          updateFlow({ steps: [...steps] })
          continue
        }
        let acc = ''
        await streamGitAgent(
          `Skill flow "${flow.name}" step "${step.label}". ${step.skill ? `Use skill ${step.skill}.` : ''} ${step.promptTemplate || ''}`,
          agent.slug,
          {
            onDelta: (t) => {
              acc += t
              accAll += t
              setLog(accAll)
              step.outputPreview = acc.slice(0, 240)
              updateFlow({ steps: [...steps] })
            },
          },
        )
        step.status = 'done'
        completed += 1
        updateFlow({ steps: [...steps] })
      }
      const history = [
        {
          id: newId('h'),
          timestamp: new Date(started).toISOString(),
          duration: `${Math.max(1, Math.round((Date.now() - started) / 1000))}s`,
          status: completed === steps.length ? 'success' as const : 'partial' as const,
          stepsCompleted: completed,
          stepsTotal: steps.length,
          triggeredBy: 'Operator',
        },
        ...(flow.history || []),
      ]
      updateFlow({ lastRun: history[0].timestamp, history, steps })
      await appendAudit({
        id: `aud_${started}`,
        ts: new Date().toISOString(),
        actor: 'operator',
        action: 'flow.run',
        target: flow.id,
        detail: flow.name,
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="grid min-h-full grid-cols-1 md:grid-cols-[300px_1fr]">
      <aside className="border-r border-border/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            <h1 className="font-serif text-lg">Skill Flows</h1>
          </div>
          <Button size="icon" variant="outline" onClick={addFlow}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-1">
          {flows.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelected(f.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selected === f.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
            >
              <p className="font-medium">{f.name}</p>
              <p className="text-[11px] text-muted-foreground">{f.steps.length} steps · {f.status}</p>
            </button>
          ))}
        </div>
      </aside>
      <section className="space-y-4 p-6">
        {!flow ? (
          <p className="text-sm text-muted-foreground">Create a flow to chain skills with approval gates.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Input value={flow.name} onChange={(e) => updateFlow({ name: e.target.value })} />
                <Textarea value={flow.description} onChange={(e) => updateFlow({ description: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void runFlow()} disabled={running || !agent?.slug}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run
                </Button>
                <Button variant="outline" onClick={() => void persist(flows.filter((f) => f.id !== flow.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {flow.steps.map((step, idx) => (
                <div key={step.id} className="rounded-xl border border-border/60 bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{idx + 1}. {step.label}</p>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">{step.type} · {step.status || 'idle'}</span>
                  </div>
                  {step.skill ? <p className="text-[12px] text-muted-foreground">Skill: {step.skill}</p> : null}
                  {step.outputPreview ? <div className="mt-2 text-xs">{renderMarkdown(step.outputPreview)}</div> : null}
                </div>
              ))}
            </div>
            {log ? <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 p-3 text-sm">{renderMarkdown(log.slice(-2000))}</div> : null}
            {flow.history && flow.history.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide">Run history</h3>
                <div className="space-y-1">
                  {flow.history.map((h) => (
                    <div key={h.id} className="flex justify-between rounded-lg border border-border/60 px-3 py-2 text-[12px]">
                      <span>{h.timestamp}</span>
                      <span className="font-mono">{h.status} · {h.stepsCompleted}/{h.stepsTotal} · {h.duration}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
