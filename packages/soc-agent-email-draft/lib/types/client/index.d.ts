import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { EmailDraftToolview, emailDraftToolview, draftFromForm, EMAIL_ATTACHMENT_LIMITS, fileToEmailAttachment, parseRecipientText, validateEmailAttachmentSelection, ZIMBRA_DRAFT_TOOL_NAME, ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME, } from './EmailDraftToolview.tsx';
export type { EmailAttachmentPayload, EmailDraftAction, EmailDraftFields, EmailDraftFormFields, EmailDraftMetadata, } from './EmailDraftToolview.tsx';
/** Optional editable email draft tool views. */
export declare const inject: readonly ["slots", "socClient"];
export declare function apply(ctx: ClientContext): void;
