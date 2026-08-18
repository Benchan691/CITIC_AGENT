export declare const inject: readonly []
export declare function apply(): void
export declare const SCHEDULED_TASK_CHANNEL: '/splunk-zimbra-schedules'
export interface ScheduledTaskBrowserClient {
  list(): Promise<unknown>
  create(payload: Record<string, unknown>): Promise<unknown>
  pause(id: string): Promise<unknown>
  resume(id: string): Promise<unknown>
  delete(id: string): Promise<unknown>
  runNow(id: string): Promise<unknown>
  updateSettings(settings: { maxConcurrentRuns: number; runTimeoutMs: number }): Promise<unknown>
  call(endpoint: string, payload?: Record<string, unknown>): Promise<unknown>
}
export declare function createScheduledTaskClient(connection: {
  rpc: { call(channel: string, endpoint: string, payload: Record<string, unknown>): Promise<unknown> }
}): ScheduledTaskBrowserClient
