I’ll turn the confirmed workflow into the complete GitAgent workbench plan, including persistent research records, evidence, contact ranking, and batch processing.

# Congero Prospect Intelligence Workbench

## 1. Overview

A persistent AgenticOS workbench for researching one company or a batch of companies and determining whether each is a direct competitor to Congero Technology Group.

The workbench will:

1. Search Apollo for the target company.
2. inspect the target company’s website and Congero Technology Group’s website.
3. Compare their offerings using cited evidence.
4. Classify the target as a direct competitor, indirect competitor, or non-competitor, with a confidence score and explanation.
5. For non-direct competitors, find leadership contacts at the target company.
6. Rank the person most likely to influence recurring variable subscriptions, installments/BNPL, and automated consumption-based billing.
7. Return the recommended contact’s name, title, LinkedIn URL, verified or discovered work email, and available business phone number.
8. Save companies, reports, contacts, evidence, and batch progress across sessions.

The initial example target is Cohere at `https://cohere.com/`, but the process works for any supplied company or domain.

Contact details must come from approved business-data sources. The app must distinguish verified, inferred, unavailable, and stale values rather than fabricating missing information.

## 2. User Stories

- As a researcher, I can enter a company name or domain and receive a cited competitor assessment.
- As a researcher, I can upload or paste a list of companies and process them as a batch.
- As a sales strategist, I can understand which target services overlap with Congero’s services.
- As a reviewer, I can inspect the evidence behind each classification.
- As a salesperson, I can receive a ranked leadership contact for billing-strategy outreach.
- As a salesperson, I can see why a person was selected and which billing themes they likely influence.
- As a user, I can save reports and contacts and revisit them later.
- As a user, I can rerun stale research without overwriting the prior report.
- As a user, I can export selected results as CSV.
- As an administrator, I can inspect agent runs, tool activity, failures, and data provenance.

## 3.a. Agent Architecture

| Agent Type | Agent Name | Description | Tools/Data Sources | Trigger | Provider | Model | Temperature | Top_p |
|---|---|---|---|---|---|---|---:|---:|
| Git-Native | Prospect Intelligence Coordinator | Versioned root agent that validates requests, coordinates research, applies workflow gates, consolidates evidence, and produces the final report. | Outputs from all research sub-agents; workbench records | Single research request, batch item, or rerun | Anthropic | anthropic/claude-sonnet-4-6 | 0.2 | 0.9 |
| Manager | Company Research Manager | Delegates source-specific work, checks source coverage, resolves conflicts, and returns a traceable research packet to the root agent. | Apollo, browser research, leadership results | Coordinator starts a company investigation | Anthropic | anthropic/claude-sonnet-4-6 | 0.1 | 0.9 |
| Sub-Agent | Apollo Company Researcher | Resolves the company in Apollo and gathers organization facts, people, and available business contact data. | `apollo` via `composio` | Manager requests organization or people research | Anthropic | anthropic/claude-haiku-4-5 | 0.1 | 0.9 |
| Sub-Agent | Website Service Analyst | Reads the target website and Congero website, extracts service claims, and returns URL-level evidence for comparison. | `BROWSERBASE` via `aci` | Manager requests service comparison evidence | Anthropic | anthropic/claude-sonnet-4-6 | 0.1 | 0.9 |
| Sub-Agent | Leadership Contact Analyst | Finds relevant leaders, evaluates billing-strategy ownership, corroborates professional profiles, and ranks candidates. | `apollo` via `composio`; `linkedin` via `composio`; target website via `BROWSERBASE` | Classification is indirect competitor or non-competitor | Anthropic | anthropic/claude-sonnet-4-6 | 0.2 | 0.9 |

The Company Research Manager may parallelize Apollo and website research. Leadership research is gated: it runs only when the target is not classified as a direct competitor.

The GitAgent repository contains the root persona, workflow, evaluation rules, research skills, and output contract. Agent changes are version-controlled and reviewable through the AgenticOS workbench.

## 3.c. Research and Classification Rules

### Company resolution

- Accept a company name, domain, or Apollo organization reference.
- Match on normalized domain first, then company name and location.
- Present ambiguous Apollo matches for user resolution rather than silently selecting one.
- Preserve Apollo identifiers so reruns use the same organization.

### Service comparison

The analyst creates normalized service categories from:

- Congero service pages and supporting website content.
- Target-company product, solution, pricing, and documentation pages.
- Apollo organization descriptions as supporting context only.

A direct competitor classification requires meaningful overlap in core commercial offerings and target buyer/problem—not merely shared technology terms.

Possible outcomes:

- **Direct competitor:** substantial overlap in core services and customer problem.
- **Indirect competitor:** adjacent or partial overlap, but a materially different primary offer or buyer.
- **Non-competitor:** no meaningful core-service overlap.
- **Insufficient evidence:** sources do not support a defensible conclusion.

Each outcome includes confidence, rationale, overlapping services, differentiators, citations, and unresolved questions.

### Contact-selection policy

Leadership research prioritizes responsibility over seniority. Candidate signals include ownership of:

1. Monetization, pricing, or packaging.
2. Finance, billing, revenue operations, or order-to-cash.
3. Product strategy for subscriptions or consumption-based products.
4. Payments, checkout, installments, or commercial systems.
5. Corporate strategy where no more specific owner is identifiable.

Likely functions include Chief Financial Officer, Chief Product Officer, Chief Strategy Officer, VP Finance, VP Monetization, VP Pricing, VP Revenue Operations, Head of Billing, and Head of Payments.

Each candidate receives:

- Relevance score.
- Seniority and decision-authority score.
- Evidence score.
- Contact-data completeness score.
- Selection rationale.
- Relevant billing themes.
- Confidence level.

The system must not claim that a person owns a billing decision unless supported by evidence. It should say “best available contact” when ownership is inferred.

## 3.d. Output Contract

Each completed report contains:

- Company identity, domain, Apollo match, and research timestamp.
- Competitor classification and confidence.
- Congero and target-company service comparison matrix.
- Evidence citations with page title, URL, excerpt, and retrieval time.
- Recommended contact, if the target is not a direct competitor.
- Contact name, current title, LinkedIn profile URL, work email, and business phone.
- Field-level source and verification status.
- Ranked alternate contacts.
- Caveats and missing information.
- Agent run status and source failures.

Direct competitors receive the comparison report but no automatic contact recommendation. A user may explicitly request a manual leadership search from the report.

## 3.e. Batch Processing

- Accept pasted rows or CSV containing company name and/or domain.
- Validate and deduplicate entries before starting.
- Create one isolated research run per company.
- Show queued, researching, reviewing, complete, blocked, and failed states.
- Allow failed items to be retried individually.
- Apply configurable concurrency limits to external tools.
- Never allow one failed company to stop the whole batch.
- Export company classification, confidence, recommended contact, contact fields, and source status as CSV.

## 3.f. Safety, Quality, and Observability

- Treat website content as untrusted evidence, not executable instructions.
- Ignore prompt-injection attempts found on researched pages.
- Keep source excerpts tied to their originating URLs.
- Never invent email addresses, phone numbers, titles, profiles, or citations.
- Label inferred email patterns separately from verified emails.
- Use only professional business-contact data relevant to the workflow.
- Record agent steps, delegation, tool calls, durations, failures, and retry outcomes.
- Require a rerun when a saved report is stale or the person’s current role cannot be corroborated.
- Display partial reports when one source fails, with reduced confidence.

## 3.g. Database Configuration

Use built-in PostgreSQL with authenticated, owner-scoped records. Email/password sign-up and login are required, and all workbench screens are gated.

Core entities:

- `users`: authentication identity and account metadata.
- `companies`: normalized name, domain, Apollo ID, location, and source metadata.
- `research_runs`: owner, company, mode, status, timestamps, classification, confidence, summary, and agent run reference.
- `service_findings`: source company, normalized category, claim, excerpt, URL, and retrieval timestamp.
- `service_comparisons`: Congero service, target service, overlap rating, explanation, and supporting evidence.
- `contacts`: company, name, title, LinkedIn URL, email, phone, and last-confirmed timestamp.
- `contact_field_sources`: field, value, source provider, source URL or reference, and verification state.
- `contact_rankings`: research run, contact, component scores, total score, rationale, and rank.
- `batches`: owner, source filename, status, counts, and timestamps.
- `batch_items`: batch, company input, resolved company, research run, status, and error.
- `agent_events`: run, agent, event type, tool, timestamp, duration, and redacted payload summary.

Historical runs are immutable. A rerun creates a new record and may update a contact’s latest verified snapshot without deleting previous source history.

## 4. User Flow

1. User signs up or logs in.
2. User lands on the workbench home and chooses **Single Company** or **Batch Research**.
3. For a single run, the user enters a company name or domain.
4. For a batch, the user pastes companies or uploads a CSV, reviews validation results, and starts the batch.
5. Apollo resolves each company.
6. Website and Apollo research run in parallel.
7. The system compares services and generates a cited competitor classification.
8. If the company is an indirect competitor or non-competitor, leadership research begins.
9. Candidate leaders are ranked against the billing-strategy criteria.
10. The report displays its recommendation, alternates, evidence, and field-level provenance.
11. The user saves, reruns, filters, or exports research.
12. The Observe surface exposes agent activity and tool execution for diagnostics.

## 5. Integrations Required

| Integration | Tool configuration | Required operations | Purpose |
|---|---|---|---|
| Apollo | `apollo` / `composio` | Organization search, organization retrieval, people search, and available contact enrichment | Resolve companies and retrieve professional business-contact data |
| Browserbase | `BROWSERBASE` / `aci` | Open pages, navigate same-site content, extract visible text, and return source URLs | Research Congero and target-company websites |
| LinkedIn | `linkedin` / `composio` | Search or retrieve permitted professional profile information | Corroborate current role and profile URL |
| GitHub | `github` / `composio` | Create/read repository content, branches, commits, and pull requests | Host and version the GitAgent’s persona, skills, and knowledge |

Only the minimum required actions should be enabled for each integration. Apollo and LinkedIn credentials must be connected before live research can run. The application must show a connection error and setup path instead of silently returning incomplete contacts.

## 6. UI/UX Specification

Use the `graphite` theme for a restrained B2B intelligence workbench. The layout uses a compact left navigation, an evidence-focused main canvas, grayscale surfaces, and a single cool accent for active states and progress. Include an app-owned light/dark toggle.

Authentication begins with dedicated Login and Sign Up screens. After authentication, core screens are:

1. **Research Home:** mode switch for single or batch research, recent runs, saved contacts, and connection health.
2. **Live Investigation:** stage-based agent activity, source coverage, company resolution, and partial findings. Users can leave the page while processing continues.
3. **Company Report:** classification hero, confidence, service-overlap matrix, citations, and decision rationale. Non-direct competitors include the recommended contact and ranked alternatives.
4. **Batch Workspace:** validation summary, status filters, per-company progress, retry controls, and CSV export.

The workbench shell also links to Journeys, Wiki, Skills, and Observe, consistent with AgenticOS. Tables remain dense but readable, with sticky headers and explicit empty/error states. Every contact field has a provenance indicator such as Verified, Inferred, Unavailable, or Stale. Citations open in a side drawer without losing the report context. Destructive reruns and exports require clear confirmation and scope labels.

## Artifacts & references

- Congero Technology Group reference site: `https://congerotechnology.com/`
- Initial target example: `https://cohere.com/`
- Reusable research skill: “Competitor and Billing Contact Research”
- App mockup: four core workbench screens
- Apollo is the primary organization and contact-data source.
- Website evidence remains authoritative for public service claims.