import type { ComposerAttachmentsProps } from 'dsh-soc-agent-ui-conversation/client';
import { MarkItDownDocumentController } from './markitdownAttachments.ts';
export declare function MarkItDownDocuments(props: ComposerAttachmentsProps & {
    controller: MarkItDownDocumentController;
}): import("react").JSX.Element | null;
export declare function openMarkItDownPicker(sessionId: string): void;
