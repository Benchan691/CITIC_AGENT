import { Service, type Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { MARKITDOWN_ATTACHMENTS_NAMESPACE } from './attachment-constants.ts'
import { MarkItDownAttachmentSettingsSchema } from './attachment-settings.ts'

export {
  DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS,
  MARKITDOWN_ATTACHMENTS_NAMESPACE,
} from './attachment-constants.ts'
export type { MarkItDownAttachmentSettings } from './attachment-constants.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Presence marker for the independently switchable attachment feature. */
    socAttachmentsFeature: SocAttachmentsFeature
  }
}

export class SocAttachmentsFeature extends Service {
  constructor(ctx: Context) {
    super(ctx, 'socAttachmentsFeature')
  }
}

/** Registers the durable attachment settings owned by this optional feature. */
export function apply(ctx: Context): void {
  ctx.plugin(SocAttachmentsFeature)
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      MARKITDOWN_ATTACHMENTS_NAMESPACE,
      MarkItDownAttachmentSettingsSchema,
    )
  })
}
