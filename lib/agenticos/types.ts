// agenticos-scaffold: v1 — domain overlay types for a GitAgent AgenticOS.
// Customize values in config.ts. The OS shell reads this shape; do not rename fields.

export type Severity = 'critical' | 'warning' | 'info' | 'success'

export type JourneyMetric = {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'primary' | 'warning' | 'destructive' | 'success'
}

export type JourneyNudge = {
  label: string
  prompt: string
}

export type PendingAction = {
  id: string
  title: string
  description: string
  urgency: Severity
  requester: string
  dueDate: string
  category: string
  href?: string
}

export type Insight = {
  id: string
  severity: Severity
  headline: string
  summary: string
  category: string
  href?: string
}

export type JourneySection = {
  id: string
  title: string
  step: string
}

export type JourneyDef = {
  slug: string
  title: string
  description: string
  icon: string
  skill: string
  cadence?: string
  sla?: string
  nudges: JourneyNudge[]
  metrics: JourneyMetric[]
  pendingActions: PendingAction[]
  sections: JourneySection[]
  dataFiles?: string[]
}

export type HomeMetric = {
  label: string
  value: string
  delta?: string
  hint?: string
}

export type IntegrationDef = {
  id: string
  name: string
  description: string
  category: string
  connected?: boolean
  dataPoints?: string
}

export type GuardrailDef = {
  id: string
  name: string
  description: string
  severity: Severity
  status: 'active' | 'paused'
}

export type AgenticOSConfig = {
  /** Empty string = use the live git-agent name from the manifest. */
  appName: string
  appSubtitle: string
  greeting: string
  tagline: string
  roleLabel: string
  searchPlaceholder: string
  /**
   * When true, one journey is created per skill on the git agent.
   * Set false and fill `journeys` for a domain-specific AgenticOS.
   */
  deriveJourneysFromSkills: boolean
  journeys: JourneyDef[]
  homeMetrics: HomeMetric[]
  insights: Insight[]
  pendingActions: PendingAction[]
  integrations: IntegrationDef[]
  guardrails: GuardrailDef[]
}

export type ManifestSkill = {
  name: string
  description: string
  path: string
}

export type ManifestKnowledge = {
  path: string
  tags: string[]
  priority: string
  alwaysLoad: boolean
}

export type ManifestAgent = {
  slug: string
  name: string
  description: string
  dir: string
  skills: ManifestSkill[]
  knowledge: ManifestKnowledge[]
  soul?: string
  rules?: string
  duties?: string
}

export type ManifestResponse = {
  agents: ManifestAgent[]
  primary: ManifestAgent | null
}

export type WikiPage = {
  slug: string
  title: string
  type: 'entity' | 'concept' | 'synthesis'
  category: string
  updated: string
  sources: string[]
  tags: string[]
  body: string
  filePath: string
}

export type WikiGraph = {
  nodes: Array<{ id: string; title: string; type: WikiPage['type']; category: string; size: number }>
  edges: Array<{ source: string; target: string }>
}

export type SkillFlowStep = {
  id: string
  label: string
  skill?: string
  type: 'skill' | 'approval_gate' | 'transform' | 'notification'
  promptTemplate?: string
  status?: 'idle' | 'running' | 'done' | 'failed'
  outputPreview?: string
}

export type SkillFlow = {
  id: string
  name: string
  description: string
  steps: SkillFlowStep[]
  status: 'active' | 'draft'
  lastRun?: string
  history?: Array<{
    id: string
    timestamp: string
    duration: string
    status: 'success' | 'partial' | 'failed'
    stepsCompleted: number
    stepsTotal: number
    triggeredBy: string
  }>
}

export type DecisionItem = {
  id: string
  title: string
  summary: string
  status: 'pending' | 'approved' | 'rejected' | 'flagged'
  severity: Severity
  journey?: string
  requestedBy: string
  createdAt: string
  detail?: string
}

export type AgentRun = {
  id: string
  journey: string
  status: 'completed' | 'running' | 'failed' | 'queued'
  startedAt: string
  duration: string
  trigger: string
  model: string
  summary?: string
  tokensIn?: number
  tokensOut?: number
  files: string[]
  trace: Array<{ id: string; label: string; type: string; detail: string; timestamp: string }>
}

export type AuditEvent = {
  id: string
  ts: string
  actor: string
  action: string
  target: string
  detail: string
}
