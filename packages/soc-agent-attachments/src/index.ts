import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { DOCUMENT_ATTACHMENTS_NAMESPACE } from './attachment-constants.ts'
import { DocumentAttachmentSettingsSchema } from './attachment-settings.ts'
import z from '@deepseek-ai/schemastery'

export {
  DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS,
  DOCUMENT_ATTACHMENTS_NAMESPACE,
} from './attachment-constants.ts'
export type { DocumentAttachmentSettings } from './attachment-constants.ts'

/** Registers the durable attachment settings owned by this optional feature. */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], async (settingsCtx) => {
    // Compatibility key only: preserve upload preferences from the old reader.
    const legacyNamespace = settingsNamespace('soc-agent-markitdown-attachments')
    const legacy = settingsCtx.settings.register(legacyNamespace, z.any())
    const current = settingsCtx.settings.register(
      settingsNamespace(DOCUMENT_ATTACHMENTS_NAMESPACE),
      DocumentAttachmentSettingsSchema,
    )
    const descriptors = settingsCtx.settings.describe()
    const old = descriptors.find(item => item.ns === legacyNamespace)?.user
    const saved = descriptors.find(item => item.ns === DOCUMENT_ATTACHMENTS_NAMESPACE)?.user
    if (old && typeof old === 'object' && !saved) {
      const values = old as Record<string, unknown>
      const limits = Object.fromEntries(['maxFiles', 'maxBytesPerFile', 'maxTotalBytes'].flatMap(key => {
        const value = values[key]
        return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? [[key, value]] : []
      }))
      await current.update(limits)
      await legacy.replace({})
    }
  })
}
