import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { EmailDraftToolview, emailDraftToolview, draftFromForm, parseRecipientText, ZIMBRA_DRAFT_TOOL_NAME, ZIMBRA_FORWARD_DRAFT_TOOL_NAME, ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME, } from './EmailDraftToolview.tsx';
export type { EmailDraftFields, EmailDraftFormFields } from './EmailDraftToolview.tsx';
/** Optional editable email draft tool views. */
export declare const inject: readonly ["slots", "socClient"];
export declare function apply(ctx: ClientContext): void;
