import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ClientRemote } from 'dsh-soc-agent-api-remotes/client'
import type {} from 'dsh-soc-agent-api-remotes/client'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import React from 'react'
import { AdminConsole } from './AdminConsole.tsx'

export { AdminConsole } from './AdminConsole.tsx'
export { validCatalog } from './SocActionApprovalSettings.tsx'
export type { SocAction } from './SocActionApprovalSettings.tsx'

/** The complete optional administration surface. */
export const inject = ['slots', 'socClient', 'remote'] as const

type LegacyResult<T> = { result: Awaited<T> }

function adminConnection(remote: ClientRemote) {
  const wrap = async <T,>(operation: Promise<T>): Promise<LegacyResult<T>> => ({ result: await operation })
  return {
    api: {
      settings: {
        describe: () => wrap(remote.settings.describe()),
        mutate: (request: { ns: string; ops: any[]; expectedRevision?: number }) =>
          wrap(remote.settings.mutate(request.ns, request.ops, request.expectedRevision)),
      },
      credentials: {
        describe: async (request: { refs: string[] }) => {
          const result = await remote.credentials.describe(request.refs)
          return { result: result.ok ? { ok: true as const, value: { credentials: result.value } } : result }
        },
        set: (request: { ref: string; value: string }) => wrap(remote.credentials.set(request.ref, request.value)),
        unset: (request: { ref: string }) => wrap(remote.credentials.unset(request.ref)),
      },
      llm: {
        providers: async () => {
          const result = await remote.llm.listConfigurableProviders()
          return { result: result.ok ? { ok: true as const, value: { providers: result.value } } : result }
        },
        discoverModels: async (request: {
          settingsNs: string
          provider?: string
          baseURL?: string
          api?: string
          apiKey?: string
        }) => {
          const { settingsNs, ...draft } = request
          const result = await remote.llm.discoverModels(settingsNs, draft)
          return { result: result.ok ? { ok: true as const, value: { models: result.value } } : result }
        },
      },
    },
  }
}

export function apply(ctx: ClientContext): void {
  if ((ctx.get('socClient') as SocClientRuntime).surface !== 'admin') return
  // The core declares this child slot only on /admin, so disabling this
  // package leaves the core-owned safe fallback in place.
  ctx.slots.inject('soc.admin.content', () => ctx.slots.register({
    name: 'soc.admin.content',
  }, props => React.createElement(AdminConsole, {
    ...props,
    connection: adminConnection(ctx.remote),
  })))
}
