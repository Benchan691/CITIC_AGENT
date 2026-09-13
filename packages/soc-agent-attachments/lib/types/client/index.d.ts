import type { Context as ClientContext } from '@deepseek-ai/cordis';
export { AttachmentSettingsController, MarkItDownAttachmentSettingsCard, } from './MarkItDownAttachmentSettings.tsx';
export { MarkItDownDocumentController } from './markitdownAttachments.ts';
export { MarkItDownDocuments, openMarkItDownPicker } from './MarkItDownDocuments.tsx';
export { DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS, MARKITDOWN_ATTACHMENTS_NAMESPACE } from '../attachment-constants.ts';
export type { MarkItDownAttachmentSettings } from '../attachment-constants.ts';
/** Optional MarkItDown attachment/document feature. */
export declare const inject: readonly ["slots", "connection", "conversation", "commandUi", "settingsScope", "socClient"];
export declare function apply(ctx: ClientContext): void;
