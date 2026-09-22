export declare const ZIMBRA_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_send_email";
export declare const ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = "mcp__soc_agent__zimbra_use_signature_on_email";
export declare const EMAIL_ATTACHMENT_LIMITS: {
    readonly maxFiles: 5;
    readonly maxBytesPerFile: 10000000;
    readonly maxTotalBytes: 50000000;
};
export interface EmailAttachmentPayload {
    filename: string;
    content_type: string;
    data: string;
}
export type EmailDraftAction = 'send' | 'reply' | 'forward';
export interface EmailDraftFields {
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    body: string;
    action?: EmailDraftAction;
    body_format?: 'html';
    source_message_id?: string;
    reply_all?: boolean;
    source_message?: {
        subject?: string;
        from?: string;
        to?: string[];
        cc?: string[];
        date?: string;
        body?: string;
        body_type?: string;
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
export interface EmailDraftMetadata {
    action?: EmailDraftAction;
    body_format?: 'html';
    source_message_id?: string;
    reply_all?: boolean;
}
export declare function validateEmailAttachmentSelection(files: readonly File[], existing?: readonly File[]): string | null;
export declare function fileToEmailAttachment(file: File): Promise<EmailAttachmentPayload>;
export declare function parseRecipientText(value: string): string[];
export declare function draftFromForm(fields: EmailDraftFormFields, metadata?: EmailDraftMetadata): EmailDraftFields;
