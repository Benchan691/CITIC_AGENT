import type { ConnectionHandle, SessionId } from 'dsh-soc-agent-connection/client';
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { ComposerDocument, ComposerDocumentProvider, DraftAttachmentId, MarkdownAttachment } from 'dsh-soc-agent-ui-conversation/client';
import { type MarkItDownAttachmentSettings } from '../attachment-constants.ts';
export declare class MarkItDownDocumentController implements ComposerDocumentProvider {
    private readonly connection;
    private readonly settings;
    private readonly drafts;
    private readonly aborts;
    private readonly listeners;
    private version;
    private readonly converted;
    constructor(connection: ConnectionHandle, settings: SettingsScope<MarkItDownAttachmentSettings>);
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
