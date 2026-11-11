export const DOCUMENT_ATTACHMENTS_NAMESPACE = 'soc-agent-document-attachments'

export interface DocumentAttachmentSettings {
  maxFiles: number
  maxBytesPerFile: number
  maxTotalBytes: number
}

export const DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS: DocumentAttachmentSettings = {
  maxFiles: 5,
  maxBytesPerFile: 10_000_000,
  maxTotalBytes: 50_000_000,
}
