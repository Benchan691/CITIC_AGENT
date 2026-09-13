import type { ComposerDocumentsProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import { MarkItDownDocumentController } from './markitdownAttachments.ts';
export declare function MarkItDownDocuments(props: ComposerDocumentsProps & {
    controller: MarkItDownDocumentController;
}): import("react").JSX.Element | null;
export declare function openMarkItDownPicker(sessionId: string): void;
