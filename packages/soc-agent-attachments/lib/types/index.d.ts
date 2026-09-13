import type { Context } from '@deepseek-ai/cordis';
export { DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS, MARKITDOWN_ATTACHMENTS_NAMESPACE, } from './attachment-constants.ts';
export type { MarkItDownAttachmentSettings } from './attachment-constants.ts';
/** Registers the durable attachment settings owned by this optional feature. */
export declare function apply(ctx: Context): void;
