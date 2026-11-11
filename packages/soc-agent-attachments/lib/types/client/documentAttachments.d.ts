import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
import type { ComposerDocument, ComposerDocumentProvider, DraftAttachmentId, MarkdownAttachment } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SessionId, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import { type DocumentAttachmentSettings } from '../attachment-constants.ts';
export declare class DocumentAttachmentController implements ComposerDocumentProvider {
    private readonly connection;
    private readonly settings;
    private readonly drafts;
    private readonly aborts;
    private readonly listeners;
    private version;
    private readonly converted;
    constructor(connection: ConnectionHandle, settings: SettingsScope<DocumentAttachmentSettings>);
    /** Abort pending conversions and release all browser-local draft state. */
    dispose(): void;
    subscribe: (listener: () => void) => (() => void);
    getVersion: () => number;
    create(sessionId: SessionId, files: readonly File[]): readonly ComposerDocument[];
    list(sessionId: SessionId, ids: readonly DraftAttachmentId[]): readonly ComposerDocument[];
    release(sessionId: SessionId, id: DraftAttachmentId): void;
    convert(sessionId: SessionId, ids: readonly DraftAttachmentId[], signal: AbortSignal): Promise<readonly MarkdownAttachment[]>;
    private setStatus;
    private changed;
}
