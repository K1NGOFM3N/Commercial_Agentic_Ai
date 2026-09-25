'use client'

export function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*(.+)\*\*$/)
    if (bold) return <strong key={i} className="font-semibold">{bold[1]}</strong>
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      return (
        <a key={i} href={link[2]} className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function renderMarkdown(text: string) {
  if (!text) return null
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="mt-3 text-sm font-semibold">{formatInline(line.slice(4))}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="mt-3 text-base font-semibold">{formatInline(line.slice(3))}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="mt-4 text-lg font-bold">{formatInline(line.slice(2))}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="ml-4 list-disc text-sm text-foreground">{formatInline(line.slice(2))}</li>
        }
        if (/^\d+\.\s/.test(line)) {
          return <li key={i} className="ml-4 list-decimal text-sm text-foreground">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        }
        if (line.startsWith('```')) return <div key={i} className="h-1" />
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm leading-relaxed text-foreground">{formatInline(line)}</p>
      })}
    </div>
  )
}
