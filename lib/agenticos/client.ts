import type {
  AgentRun,
  AuditEvent,
  DecisionItem,
  ManifestResponse,
  SkillFlow,
  WikiGraph,
  WikiPage,
} from './types'

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      detail = body?.error || detail
    } catch {
      // keep status text
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export function fetchManifest() {
  return json<ManifestResponse>('/api/agenticos/manifest')
}

export function fetchAgentFile(path: string) {
  return json<{ path: string; content: string; size: number }>(
    `/api/agenticos/files?path=${encodeURIComponent(path)}`,
  )
}

export function listAgentFiles(prefix = '') {
  return json<{ files: Array<{ path: string; type: 'file' | 'directory'; size: number }> }>(
    `/api/agenticos/files?list=1&path=${encodeURIComponent(prefix)}`,
  )
}

export function fetchWiki() {
  return json<{ pages: WikiPage[]; graph: WikiGraph }>('/api/agenticos/wiki')
}

export function saveWikiPage(page: Partial<WikiPage> & { title: string; body: string }) {
  return json<{ page: WikiPage }>('/api/agenticos/wiki', {
    method: 'POST',
    body: JSON.stringify(page),
  })
}

export function loadStore<T>(collection: string) {
  return json<{ items: T[] }>(`/api/agenticos/store?collection=${encodeURIComponent(collection)}`)
}

export function saveStore<T>(collection: string, items: T[]) {
  return json<{ items: T[] }>('/api/agenticos/store', {
    method: 'PUT',
    body: JSON.stringify({ collection, items }),
  })
}

export function appendStore<T>(collection: string, item: T) {
  return json<{ items: T[] }>('/api/agenticos/store', {
    method: 'POST',
    body: JSON.stringify({ collection, item }),
  })
}

export function loadFlows() {
  return loadStore<SkillFlow>('flows')
}

export function saveFlows(items: SkillFlow[]) {
  return saveStore('flows', items)
}

export function loadIntegrations() {
  return loadStore<{ id: string; connected: boolean; lastSync?: string }>('integrations')
}

export function saveIntegrations(items: Array<{ id: string; connected: boolean; lastSync?: string }>) {
  return saveStore('integrations', items)
}

export function loadInbox() {
  return loadStore<DecisionItem>('inbox')
}

export function saveInbox(items: DecisionItem[]) {
  return saveStore('inbox', items)
}

export function loadRuns() {
  return loadStore<AgentRun>('runs')
}

export function saveRuns(items: AgentRun[]) {
  return saveStore('runs', items)
}

export function loadAudit() {
  return loadStore<AuditEvent>('audit')
}

export function appendAudit(event: AuditEvent) {
  return appendStore('audit', event)
}
