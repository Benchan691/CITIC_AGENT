import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SocActionMode } from '../action-approval-settings.ts'

export async function readActionMode(connection: ConnectionHandle, mode?: SocActionMode): Promise<SocActionMode> {
  const result = await connection.rpc.call('/soc-agent-config', mode === undefined ? 'get-action-policy' : 'set-action-mode', mode === undefined ? {} : { mode })
  if (!result?.ok) throw new Error(result?.error?.message || 'Action settings are unavailable.')
  const value = result.value
  if (!value || typeof value !== 'object' || !('mode' in value) || (value.mode !== 'soc' && value.mode !== 'full')) {
    throw new Error('The server returned an invalid access mode.')
  }
  return value.mode
}
