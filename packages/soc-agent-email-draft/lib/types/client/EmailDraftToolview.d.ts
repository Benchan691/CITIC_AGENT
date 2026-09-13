import type { Context } from '@deepseek-ai/cordis';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { SocClientRuntime } from 'dsh-soc-agent-client/client';
import React from 'react';
export { draftFromForm, parseRecipientText, ZIMBRA_DRAFT_TOOL_NAME, ZIMBRA_FORWARD_DRAFT_TOOL_NAME, ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME, } from './emailDraft.ts';
export type { EmailDraftFields, EmailDraftFormFields } from './emailDraft.ts';
interface EmailDraftProps extends ToolCallViewProps {
    socClient: SocClientRuntime;
}
export declare function EmailDraftToolview({ block, socClient }: EmailDraftProps): React.JSX.Element;
export declare const emailDraftToolview: {
    name: string;
    inject: string[];
    apply(ctx: Context): void;
};
export declare function installEmailDraftToolview(ctx: ClientContext): void;
