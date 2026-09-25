'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Send, Square } from 'lucide-react'
import { streamGitAgent } from '@/lib/gitAgent'
import { appendAudit } from '@/lib/agenticos/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAgenticos } from './os-shell'
import { AgentPipelineContent, type PipelineStep } from './pipeline'
import { renderMarkdown } from './markdown'

type Msg = { id: string; role: 'user' | 'agent'; text: string }

export function ConsoleView() {
  const params = useSearchParams()
  const preset = params.get('q') || ''
  const { agent, journeys } = useAgenticos()
  const [input, setInput] = useState(preset)
  const [messages, setMessages] = useState<Msg[]>([])
  const [steps, setSteps] = useState<PipelineStep[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const bootstrapped = useRef(false)

  const send = async (text: string) => {
    if (!text.trim() || !agent?.slug) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', text: text.trim() }
    const agentMsg: Msg = { id: `a-${Date.now()}`, role: 'agent', text: '' }
    setMessages((prev) => [...prev, userMsg, agentMsg])
    setInput('')
    setRunning(true)
    setError('')
    setSteps([{ id: 'load', label: 'Loading agent…', status: 'running' }])
    let acc = ''
    try {
      await streamGitAgent(
        text.trim(),
        agent.slug,
        {
          onDelta: (t) => {
            acc += t
            setMessages((prev) => prev.map((m) => (m.id === agentMsg.id ? { ...m, text: acc } : m)))
            setSteps((prev) => prev.map((s) => (s.id === 'load' ? { ...s, status: 'done' } : s)))
          },
          onToolEvent: (e) => {
            setSteps((prev) => [
              ...prev.filter((s) => s.id !== (e.file || e.tool || e.type)),
              { id: e.file || e.tool || e.type, label: e.action || e.type, status: 'done', detail: e.file },
            ])
          },
          onError: (msg) => setError(msg),
        },
        { signal: ac.signal },
      )
      await appendAudit({
        id: `aud_${Date.now()}`,
        ts: new Date().toISOString(),
        actor: 'operator',
        action: 'console.chat',
        target: agent.slug,
        detail: text.trim().slice(0, 160),
      })
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (bootstrapped.current || !preset || !agent?.slug) return
    bootstrapped.current = true
    void send(preset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, agent?.slug])

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border/60 px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Agent console</p>
          <h1 className="font-serif text-2xl">{agent?.name || 'GitAgent'}</h1>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">Ask anything. The agent will read its skills, knowledge, and memory.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'ml-12 rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground' : 'mr-8'}>
              {m.role === 'agent' ? renderMarkdown(m.text || (running ? '…' : '')) : m.text}
            </div>
          ))}
          {steps.length > 0 && <AgentPipelineContent steps={steps} />}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex gap-2 border-t border-border/60 p-4 pr-16">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the agent…"
            className="min-h-[48px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
          />
          {running ? (
            <Button variant="destructive" onClick={() => abortRef.current?.abort()}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => void send(input)} disabled={!input.trim() || !agent?.slug}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
      <aside className="hidden w-72 shrink-0 border-l border-border/60 p-4 lg:block">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Quick actions</p>
        <div className="mt-2 space-y-1.5">
          {journeys.slice(0, 6).map((j) => (
            <button
              key={j.slug}
              type="button"
              className="block w-full rounded-lg border border-border/60 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => void send(`Run the ${j.title} journey and summarize.`)}
            >
              {j.title}
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
