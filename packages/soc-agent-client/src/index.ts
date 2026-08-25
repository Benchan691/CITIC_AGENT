/** Node half — registers the durable browser settings schema. */
import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { MARKITDOWN_ATTACHMENTS_NAMESPACE } from './attachment-constants.ts'
import { MarkItDownAttachmentSettingsSchema } from './attachment-settings.ts'

export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(MARKITDOWN_ATTACHMENTS_NAMESPACE),
      MarkItDownAttachmentSettingsSchema,
    )
  })
}
