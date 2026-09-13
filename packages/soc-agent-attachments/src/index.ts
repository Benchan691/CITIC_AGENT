import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { MARKITDOWN_ATTACHMENTS_NAMESPACE } from './attachment-constants.ts'
import { MarkItDownAttachmentSettingsSchema } from './attachment-settings.ts'

export {
  DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS,
  MARKITDOWN_ATTACHMENTS_NAMESPACE,
} from './attachment-constants.ts'
export type { MarkItDownAttachmentSettings } from './attachment-constants.ts'

/** Registers the durable attachment settings owned by this optional feature. */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(MARKITDOWN_ATTACHMENTS_NAMESPACE),
      MarkItDownAttachmentSettingsSchema,
    )
  })
}
