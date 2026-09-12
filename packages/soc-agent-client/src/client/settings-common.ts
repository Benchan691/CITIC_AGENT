import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'

export const CHANNEL = '/soc-agent-config'

export async function rpc(connection: ConnectionHandle, name: string, payload: Record<string, unknown> = {}) {
  const result = await connection.rpc.call(CHANNEL, name, payload)
  if (!result?.ok) throw new Error(result?.error?.message || `Request failed: ${name}`)
  return result.value
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
