/**
 * @citic/soc-memory: tenant-isolated persistent memory for the CITIC SOC Agent.
 *
 * @module @citic/soc-memory
 */
import type { Context } from '@deepseek-ai/cordis'
import type z from '@deepseek-ai/schemastery'

export type MemoryScopeType = 'global' | 'analyst' | 'customer' | 'incident'
export type MemoryVerification = 'verified' | 'unverified' | 'stale' | 'superseded'
export type MemorySourceType =
  | 'splunk_investigation'
  | 'zimbra_email'
  | 'customer_report'
  | 'analyst_confirmation'
  | 'user_confirmed'
  | 'memory_review'
  | 'automatic_extraction'
  | 'system_configuration'

export const MEMORY_SCOPE_TYPES: readonly MemoryScopeType[]
export const MEMORY_SOURCE_TYPES: readonly MemorySourceType[]
export const MEMORY_STATES: readonly MemoryVerification[]
export const MEMORY_TYPES: readonly string[]

export function assertModelCannotSelectTenant(args: unknown): void
export function isMemoryTypeAllowed(scope: MemoryScopeType, type: string): boolean
export function normalizeMemoryScopeType(value: unknown, fallback?: MemoryScopeType): MemoryScopeType
export function normalizeTenantContext(value?: unknown): Record<string, string>
export function parseScopeKey(value: string): {
  kind: MemoryScopeType
  customerId?: string
  analystId?: string
  incidentId?: string
}
export function scopeKeyForTenant(scope: MemoryScopeType, tenant?: Record<string, unknown>): string

/** Loader configuration for the CITIC SOC memory plugin. */
export interface MemoryConfig {
  /** Memory directory; empty defaults to `$DSH_HOME/memories`. */
  memoryDir?: string
  /** Byte budget for the injected summary (default 8000). */
  maxBytes?: number
  /** Byte budget for the consolidation input sent to the merge model (default 40000). */
  consolidateMaxBytes?: number
  /** Number of previous summary versions retained for rollback (default 20, 0 disables history). */
  keepSummaryVersions?: number
  /** Byte threshold above which oldest raw entries are archived (default 200000). */
  rawArchiveMaxBytes?: number
  /** Distill meaningful turns into rollout summaries when automatic capture is enabled. */
  autoSummarize?: boolean
  /** Provider used for summarization; defaults to the selected agent model. */
  summarizeProvider?: string
  /** Model used for summarization; defaults to the selected agent model. */
  summarizeModel?: string
  /** Minimum interval between summaries for one session in milliseconds (default 300000; 0 disables debounce). */
  summarizeDebounceMs?: number
  /** Rollout summaries written before re-consolidating the global summary (default 3). */
  consolidateEvery?: number
  /** Maximum output tokens for turn summarization (default 600). */
  summaryMaxTokens?: number
  /** Maximum output tokens for summary consolidation (default 1500). */
  consolidateMaxTokens?: number
  /** Retries after a transient LLM failure (default 1). */
  llmRetries?: number
  /** Maximum concurrent turn summarizations before new jobs are dropped (default 4). */
  maxActiveSummaries?: number
  /** Enable SOC tenant scopes (default true). */
  scopedMemory?: boolean
  /** Injected byte budget for one tenant-scoped summary (default 2400). */
  scopeMaxBytes?: number
  /** Redact detected credential patterns from injected summaries (default true). */
  redactSecrets?: boolean
  /** SOC scope keys or scope kinds that are read-only for writes ('*' for all). */
  readOnlyScopes?: string[]
  /** OpenAI-compatible embedding base URL used when `vector:true` (empty = local hashed vectors). */
  embeddingBaseURL?: string
  /** Bearer API key for the embedding endpoint. */
  embeddingApiKey?: string
  /** Embedding model id sent to the endpoint. */
  embeddingModel?: string
  /** Seed the first summary from `$DSH_HOME/AGENTS.md` (default false). */
  seedFromAgentsMd?: boolean
  /** Enable candidate extraction; rollout phase still gates persistence. */
  autoCapture?: boolean
  /** Reserved for explicit future opt-in; tool results are not captured by default. */
  captureToolResults?: boolean
  /** Strict tenant isolation is the only supported mode. */
  customerIsolation?: 'strict'
  /** Require source metadata and a host-derived source session. */
  provenanceRequired?: boolean
  /** Staged rollout gate for read-only, manual, automatic, and consolidation phases. */
  rolloutPhase?: 'read-only' | 'manual' | 'automatic' | 'consolidation'
  /** Default scope kind used by recall and automatic extraction. */
  defaultScope?: MemoryScopeType
}

/** Schemastery schema of {@link MemoryConfig}. */
export const Config: z<MemoryConfig>

/** Stable plugin name used by the Loader. */
export const name: 'soc-memory'

/** Cordis plugin entry. */
export function apply(ctx: Context, config?: MemoryConfig): void

export const AUTO_MEMORY_SKILL: {
  name: 'auto-memory'
  description: string
  whenToUse: string
  content: string
}

export function parseCandidateResponse(text: string): {
  summary: string
  candidates: Array<Record<string, unknown>>
}
