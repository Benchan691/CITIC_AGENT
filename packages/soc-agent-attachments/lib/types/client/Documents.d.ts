import type { ComposerDocumentsProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import { DocumentAttachmentController } from './documentAttachments.ts';
export declare function Documents(props: ComposerDocumentsProps & {
    controller: DocumentAttachmentController;
}): import("react").JSX.Element | null;
export declare function openDocumentPicker(sessionId: string): void;
