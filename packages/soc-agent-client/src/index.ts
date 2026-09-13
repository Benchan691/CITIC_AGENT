/** Node half — registers the durable browser settings schema. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { SOC_ACTION_APPROVAL_NAMESPACE, SocActionApprovalSettingsSchema } from './core/action-approval-settings.ts'

export {
  SOC_ACTION_APPROVAL_NAMESPACE,
  SocActionApprovalSettingsSchema,
} from './core/action-approval-settings.ts'
export type {
  SocActionApprovalSettings,
  SocActionMode,
  SocActionState,
} from './core/action-approval-settings.ts'

export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      SOC_ACTION_APPROVAL_NAMESPACE,
      SocActionApprovalSettingsSchema,
    )
  })
}
