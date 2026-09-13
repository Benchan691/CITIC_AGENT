import type { SocActionMode, SocClientRuntime } from 'dsh-soc-agent-client/client'

export async function readActionMode(client: SocClientRuntime, mode?: SocActionMode): Promise<SocActionMode> {
  const value = await client.rpc<{ mode?: unknown }>(mode === undefined ? 'get-action-policy' : 'set-action-mode', mode === undefined ? {} : { mode })
  if (!value || typeof value !== 'object' || !('mode' in value) || (value.mode !== 'soc' && value.mode !== 'full')) {
    throw new Error('The server returned an invalid access mode.')
  }
  return value.mode
}
