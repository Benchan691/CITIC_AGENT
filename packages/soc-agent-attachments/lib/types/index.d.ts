import type { Context } from '@deepseek-ai/cordis';
export { DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS, DOCUMENT_ATTACHMENTS_NAMESPACE, } from './attachment-constants.ts';
export type { DocumentAttachmentSettings } from './attachment-constants.ts';
/** Registers the durable attachment settings owned by this optional feature. */
export declare function apply(ctx: Context): void;
