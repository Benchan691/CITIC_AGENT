import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { downloadReportArtifact, reportSettingsEndpoint, type ReportAuth, type ReportCommand } from './host.ts'
import { REPORT_CHANNEL } from './report-contract.ts'

export { downloadReportArtifact, reportSettingsEndpoint, validateStoredArtifact } from './host.ts'
export { REPORT_CHANNEL, REPORT_TOOL_NAME } from './report-contract.ts'
export const inject = ['socAuth', 'connection', 'webServer'] as const

interface ReportsHostContext {
  socAuth: ReportAuth
  connection: { rpc: { handle(channel: string, handler: (endpoint: string, payload: unknown) => Promise<unknown>, options: { authority: string }): () => Promise<void> } }
  webServer: { register(route: { kind: 'prefix'; path: string; handler(request: IncomingMessage, response: ServerResponse): Promise<void> }): () => void }
  effect(callback: () => unknown, label: string): void
}

export function apply(ctx: Context): void {
  const host = ctx as unknown as ReportsHostContext
  const command: ReportCommand = async (operation, payload) => {
    // The product owns the authenticated Python control channel; loading it
    // lazily keeps this optional package independently testable and removable.
    // @ts-ignore The product's maintained host entry is JavaScript.
    const { runAuthCommand } = await import('dsh-soc-agent/ownership')
    return await runAuthCommand(operation, payload)
  }
  host.effect(() => host.connection.rpc.handle(REPORT_CHANNEL, (endpoint, payload) => reportSettingsEndpoint(host.socAuth, command, endpoint, payload), { authority: 'trusted-host' }), 'soc-agent-reports: user settings channel')
  host.effect(() => host.webServer.register({
    kind: 'prefix', path: `${REPORT_CHANNEL}/download`,
    handler: (request, response) => downloadReportArtifact(request, response, host.socAuth, command),
  }), 'soc-agent-reports: authenticated downloads')
}
