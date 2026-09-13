export declare const ZIMBRA_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_send_email";
export declare const ZIMBRA_FORWARD_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_forward_email";
export declare const ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_use_signature_on_email";
export interface EmailDraftFields {
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    body: string;
    body_format?: 'text' | 'html';
    forward_message_id?: string;
    forwarded_message?: {
        subject?: string;
        from?: string;
        date?: string;
        body?: string;
        body_truncated?: boolean;
        attachments?: {
            filename: string;
            part: string;
        }[];
    };
}
export interface EmailDraftFormFields {
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
}
export declare function parseRecipientText(value: string): string[];
export declare function draftFromForm(fields: EmailDraftFormFields, forwardMessageId?: string): EmailDraftFields;
