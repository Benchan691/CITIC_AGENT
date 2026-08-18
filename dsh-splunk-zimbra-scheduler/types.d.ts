export type ScheduledTaskRule =
  | { kind: 'once'; at: string }
  | { kind: 'cron'; expression: string; timeZone: string }

export type ScheduledTaskStatus = 'active' | 'paused' | 'completed'
export type ScheduledTaskRunState = 'queued' | 'running' | 'completed' | 'failed' | 'skipped_overlap'

export interface ScheduledTask {
  id: string
  name: string
  prompt: string
  rule: ScheduledTaskRule
  status: ScheduledTaskStatus
  createdAt: string
  updatedAt: string
  nextRunAt: string | null
  lastRunAt?: string
}

export interface ScheduledTaskRun {
  id: string
  taskId: string
  scheduledFor: string
  startedAt?: string
  finishedAt?: string
  state: ScheduledTaskRunState
  sessionId?: string
  errorCode?: string
}

export interface ScheduledTaskSettings {
  maxConcurrentRuns: number
  runTimeoutMs: number
}

export declare const READ_ONLY_DOMAIN_TOOLS: readonly string[]
export declare function normalizeRule(
  input: { at: string | { date: string; time: string; time_zone: string }; cron?: never; time_zone?: never }
    | { at?: never; cron: string; time_zone: string },
  now?: number,
): { rule: ScheduledTaskRule; nextRunAt: string }
export declare function latestDue(task: ScheduledTask, now?: number): string | null
