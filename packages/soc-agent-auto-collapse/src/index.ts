import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { SOC_AUTO_COLLAPSE_NAMESPACE, SocAutoCollapseSettingsSchema } from './settings.ts'

export { SOC_AUTO_COLLAPSE_NAMESPACE, SocAutoCollapseSettingsSchema } from './settings.ts'
export type { SocAutoCollapseSettings } from './settings.ts'

export function apply(ctx: Context): void {
  ctx.inject(['settings'], scope => {
    scope.settings.register(SOC_AUTO_COLLAPSE_NAMESPACE, SocAutoCollapseSettingsSchema)
  })
}
