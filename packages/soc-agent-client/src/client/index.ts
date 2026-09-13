import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from 'dsh-soc-agent-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from 'dsh-soc-agent-ui-layout/client'
import { AuthGate } from './core/AuthGate.tsx'
import { AdminUnavailable } from './core/AdminUnavailable.tsx'
import { createSocClientRuntime, socSurface } from './contract.ts'

export type { SocAdminContentOwnerProps, SocAdminRootProps, SocClientRuntime } from './contract.ts'
export { createSocClientRuntime, socSurface, SOC_CONFIG_CHANNEL } from './contract.ts'
export type {
  SocActionApprovalSettings,
  SocActionMode,
  SocActionState,
} from '../core/action-approval-settings.ts'

export const inject = ['slots', 'connection'] as const

export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as unknown as ConnectionHandle
  const path = typeof window === 'undefined' ? '' : window.location.pathname
  const surface = socSurface(path)
  const socClient = createSocClientRuntime(connection, surface)
  ctx.provide('socClient', socClient)

  if (surface === 'admin') {
    // The core owns this root so disabling the optional admin feature never
    // falls through to the regular workspace shell at /admin.
    ctx.slots.inject('root', () => ctx.slots.register({
      name: 'root',
      priority: -1,
      children: {
        'soc.admin.content': { kind: 'single', scope: 'root' },
      },
      inject: () => ({ connection, socClient }),
    }, AdminUnavailable))
    return
  }
  // Authentication remains mandatory for the regular workspace surface.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'soc-agent-auth-gate',
    priority: -100,
  }, AuthGate))
}
