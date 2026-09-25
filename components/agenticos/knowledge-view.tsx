'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, FileText, FolderOpen } from 'lucide-react'
import { fetchAgentFile, listAgentFiles } from '@/lib/agenticos/client'
import { useAgenticos } from './os-shell'
import { renderMarkdown } from './markdown'

export function KnowledgeView() {
  const { agent } = useAgenticos()
  const [files, setFiles] = useState<Array<{ path: string; type: 'file' | 'directory'; size: number }>>([])
  const [selected, setSelected] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!agent?.dir) return
    listAgentFiles(`${agent.dir}/knowledge`)
      .then((r) => setFiles(r.files.filter((f) => f.type === 'file')))
      .catch(() => setFiles([]))
  }, [agent?.dir])

  useEffect(() => {
    if (!selected) return
    fetchAgentFile(selected)
      .then((f) => setContent(f.content))
      .catch(() => setContent('Unable to read this file.'))
  }, [selected])

  const indexed = useMemo(() => new Set((agent?.knowledge || []).map((k) => k.path)), [agent])

  return (
    <div className="grid min-h-full grid-cols-1 md:grid-cols-[340px_1fr]">
      <aside className="border-r border-border/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h1 className="font-serif text-lg">Knowledge Base</h1>
        </div>
        <p className="mb-3 text-[12px] text-muted-foreground">
          Files from {agent?.dir || 'the git-native agent'}/knowledge. Indexed entries from knowledge/index.yaml are marked.
        </p>
        <div className="space-y-1">
          {files.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => setSelected(f.path)}
              className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm ${selected === f.path ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
            >
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate">{f.path.replace(`${agent?.dir}/knowledge/`, '')}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {f.size} B{indexed.has(f.path.replace(`${agent?.dir}/knowledge/`, '')) ? ' · indexed' : ''}
                </span>
              </span>
            </button>
          ))}
          {files.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              <FolderOpen className="mb-2 h-4 w-4" />
              No knowledge files yet. Add them with create_git_agent / update_git_agent.
            </div>
          )}
        </div>
      </aside>
      <section className="p-6">
        {selected ? (
          selected.endsWith('.md') ? (
            renderMarkdown(content)
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/40 p-4 font-mono text-xs">{content}</pre>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Select a knowledge file to preview it.</p>
        )}
      </section>
    </div>
  )
}
