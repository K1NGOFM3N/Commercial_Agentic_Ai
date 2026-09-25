'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Network, Plus, Send } from 'lucide-react'
import { fetchWiki, saveWikiPage } from '@/lib/agenticos/client'
import { streamGitAgent } from '@/lib/gitAgent'
import type { WikiGraph, WikiPage } from '@/lib/agenticos/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { renderMarkdown } from './markdown'
import { useAgenticos } from './os-shell'

export function WikiView() {
  const { agent } = useAgenticos()
  const [pages, setPages] = useState<WikiPage[]>([])
  const [graph, setGraph] = useState<WikiGraph>({ nodes: [], edges: [] })
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const reload = () =>
    fetchWiki()
      .then((data) => {
        setPages(data.pages)
        setGraph(data.graph)
        if (!selected && data.pages[0]) setSelected(data.pages[0].slug)
      })
      .catch((err: Error) => setError(err.message))

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const page = pages.find((p) => p.slug === selected) || null
  const layout = useMemo(() => {
    const n = graph.nodes.length || 1
    return graph.nodes.map((node, i) => {
      const angle = (i / n) * Math.PI * 2
      const r = 90
      return { ...node, x: 140 + Math.cos(angle) * r, y: 110 + Math.sin(angle) * r }
    })
  }, [graph.nodes])

  const ask = async () => {
    if (!query.trim() || !agent?.slug) return
    setAsking(true)
    setAnswer('')
    let acc = ''
    try {
      await streamGitAgent(
        `You are answering from the LLM wiki. Use memory/wiki and knowledge files. Question: ${query.trim()}`,
        agent.slug,
        {
          onDelta: (t) => {
            acc += t
            setAnswer(acc)
          },
          onError: (msg) => setError(msg),
        },
      )
    } finally {
      setAsking(false)
    }
  }

  const createPage = async () => {
    if (!draftTitle.trim() || !draftBody.trim()) return
    setSaving(true)
    try {
      const res = await saveWikiPage({ title: draftTitle.trim(), body: draftBody.trim(), type: 'synthesis', category: 'notes' })
      setDraftTitle('')
      setDraftBody('')
      await reload()
      if (res.page) setSelected(res.page.slug)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid min-h-full grid-cols-1 lg:grid-cols-[280px_1fr_300px]">
      <aside className="border-r border-border/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <h1 className="font-serif text-lg">LLM Wiki</h1>
        </div>
        <div className="space-y-1">
          {pages.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setSelected(p.slug)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${selected === p.slug ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
            >
              <span className="block font-medium">{p.title}</span>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{p.type}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="p-6">
        <svg viewBox="0 0 280 220" className="mb-6 h-52 w-full rounded-xl border border-border/60 bg-card">
          {graph.edges.map((e, i) => {
            const a = layout.find((n) => n.id === e.source)
            const b = layout.find((n) => n.id === e.target)
            if (!a || !b) return null
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-border" strokeWidth="1" />
          })}
          {layout.map((n) => (
            <g key={n.id} onClick={() => setSelected(n.id)} className="cursor-pointer">
              <circle cx={n.x} cy={n.y} r={n.size / 2} className={selected === n.id ? 'fill-primary' : 'fill-primary/40'} />
              <text x={n.x} y={n.y + n.size / 2 + 10} textAnchor="middle" className="fill-muted-foreground text-[8px]">
                {n.title.slice(0, 18)}
              </text>
            </g>
          ))}
        </svg>
        {page ? (
          <article>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{page.category}</p>
            <h2 className="font-serif text-2xl">{page.title}</h2>
            <div className="mt-4">{renderMarkdown(page.body)}</div>
          </article>
        ) : (
          <p className="text-sm text-muted-foreground">No wiki pages yet. Ask a question or create a note.</p>
        )}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </section>

      <aside className="space-y-4 border-l border-border/60 p-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Ask the wiki</p>
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Query the knowledge graph…" onKeyDown={(e) => e.key === 'Enter' && void ask()} />
            <Button size="icon" onClick={() => void ask()} disabled={asking || !query.trim()}>
              {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {answer ? <div className="mt-3 max-h-48 overflow-y-auto text-sm">{renderMarkdown(answer)}</div> : null}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">New page</p>
          <Input className="mb-2" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Title" />
          <Textarea className="mb-2 min-h-[120px]" value={draftBody} onChange={(e) => setDraftBody(e.target.value)} placeholder="Markdown body. Link pages with [[Page title]]." />
          <Button onClick={() => void createPage()} disabled={saving || !draftTitle.trim() || !draftBody.trim()}>
            <Plus className="h-4 w-4" /> Save page
          </Button>
        </div>
      </aside>
    </div>
  )
}
