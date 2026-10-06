import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import { ReportArtifacts } from './ReportArtifacts.tsx'
import { CustomerReportSettingsCard } from './ReportSettings.tsx'
import { REPORT_TOOL_NAME } from '../report-contract.ts'

export { ReportArtifacts } from './ReportArtifacts.tsx'
export { CustomerReportSettingsCard } from './ReportSettings.tsx'
export { reportPanelResult, validReportArtifact, validateCustomerProfiles } from '../report-contract.ts'
export const inject = ['slots', 'connection', 'socClient'] as const

export function apply(ctx: ClientContext): void {
  if ((ctx.get('socClient') as SocClientRuntime).surface !== 'workspace') return
  const connection = ctx.get('connection') as ConnectionHandle
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'customer-reports', order: 18, label: () => 'Customer reports', inject: () => ({ connection }),
  }, CustomerReportSettingsCard))
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview', key: REPORT_TOOL_NAME,
  }, ReportArtifacts))
}
