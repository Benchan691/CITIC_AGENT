import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import { AdminConsole } from './AdminConsole.tsx'

export { AdminConsole } from './AdminConsole.tsx'
export { validCatalog } from './SocActionApprovalSettings.tsx'
export type { SocAction } from './SocActionApprovalSettings.tsx'

/** The complete optional administration surface. */
export const inject = ['slots', 'socClient'] as const

export function apply(ctx: ClientContext): void {
  if ((ctx.get('socClient') as SocClientRuntime).surface !== 'admin') return
  // The core declares this child slot only on /admin, so disabling this
  // package leaves the core-owned safe fallback in place.
  ctx.slots.inject('soc.admin.content', () => ctx.slots.register({
    name: 'soc.admin.content',
  }, AdminConsole))
}
