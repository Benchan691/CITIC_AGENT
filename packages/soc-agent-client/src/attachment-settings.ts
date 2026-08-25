import z from '@deepseek-ai/schemastery'
export { DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS, MARKITDOWN_ATTACHMENTS_NAMESPACE, type MarkItDownAttachmentSettings } from './attachment-constants.ts'
import type { MarkItDownAttachmentSettings } from './attachment-constants.ts'

export const MarkItDownAttachmentSettingsSchema: z<MarkItDownAttachmentSettings> = z.object({
  maxFiles: z.number().step(1).min(1).max(20).default(5),
  maxBytesPerFile: z.number().step(1).min(1).max(100_000_000).default(10_000_000),
  maxTotalBytes: z.number().step(1).min(1).max(500_000_000).default(50_000_000),
  maxCharsPerFile: z.number().step(1).min(1).max(2_000_000).default(200_000),
  maxTotalChars: z.number().step(1).min(1).max(5_000_000).default(500_000),
})
