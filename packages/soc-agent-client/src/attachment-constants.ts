export const MARKITDOWN_ATTACHMENTS_NAMESPACE = 'soc-agent-markitdown-attachments'

export interface MarkItDownAttachmentSettings {
  maxFiles: number
  maxBytesPerFile: number
  maxTotalBytes: number
  maxCharsPerFile: number
  maxTotalChars: number
}

export const DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS: MarkItDownAttachmentSettings = {
  maxFiles: 5,
  maxBytesPerFile: 10_000_000,
  maxTotalBytes: 50_000_000,
  maxCharsPerFile: 200_000,
  maxTotalChars: 500_000,
}
