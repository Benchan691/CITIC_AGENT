import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { AttachmentSettingsController, DocumentAttachmentSettingsCard, } from './DocumentAttachmentSettings.tsx';
export { DocumentAttachmentController } from './documentAttachments.ts';
export { Documents, openDocumentPicker } from './Documents.tsx';
export { DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS, DOCUMENT_ATTACHMENTS_NAMESPACE } from '../attachment-constants.ts';
export type { DocumentAttachmentSettings } from '../attachment-constants.ts';
/** Optional on-demand attachment/document feature. */
export declare const inject: readonly ["slots", "connection", "conversation", "commandUi", "settingsScope", "socClient"];
export declare function apply(ctx: ClientContext): void;
