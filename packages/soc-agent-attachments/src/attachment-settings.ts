import z from '@deepseek-ai/schemastery'
export { DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS, DOCUMENT_ATTACHMENTS_NAMESPACE, type DocumentAttachmentSettings } from './attachment-constants.ts'
import type { DocumentAttachmentSettings } from './attachment-constants.ts'

export const DocumentAttachmentSettingsSchema: z<DocumentAttachmentSettings> = z.object({
  maxFiles: z.number().step(1).min(1).max(20).default(5),
  maxBytesPerFile: z.number().step(1).min(1).max(100_000_000).default(10_000_000),
  maxTotalBytes: z.number().step(1).min(1).max(500_000_000).default(50_000_000),
})
