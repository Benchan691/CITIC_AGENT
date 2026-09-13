/** CITIC/Sentinel occupants for the standard Harness brand slots. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import type {} from 'dsh-soc-agent-sidebar/client'
import { CiticBrandMark, CiticBrandName } from './CiticBrand.tsx'

export { CiticBrandMark, CiticBrandName } from './CiticBrand.tsx'

/** Required services: the shared slot registry and mandatory SOC runtime. */
export const inject = ['slots', 'socClient'] as const

/** Fill the standard sidebar and conversation branding seats. */
export function apply(ctx: ClientContext): void {
  const socClient = ctx.get('socClient') as SocClientRuntime
  if (socClient.surface !== 'workspace') return
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.inject('conversation.hero.brand.mark', function* () {
        yield ctx.slots.register({ name: 'sidebar.brand.mark' }, CiticBrandMark)
        yield ctx.slots.register({ name: 'sidebar.brand.name' }, CiticBrandName)
        yield ctx.slots.register({ name: 'conversation.hero.brand.mark' }, CiticBrandMark)
      })))
}
