import type { SocClientRuntime } from 'dsh-soc-agent-client/client'

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function rpc<T = unknown>(client: SocClientRuntime, name: string, payload: Record<string, unknown> = {}): Promise<T> {
  return client.rpc<T>(name, payload)
}
