import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import { type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { DocumentAttachmentSettings } from '../attachment-constants.ts';
interface FieldState {
    text: string;
    overridden: boolean;
    invalid: boolean;
}
interface AttachmentSettingsState {
    available: boolean;
    writable: boolean;
    dirty: boolean;
    invalid: boolean;
    saving: boolean;
    failed: boolean;
    maxFiles: FieldState;
    maxBytesPerFile: FieldState;
    maxTotalBytes: FieldState;
}
export interface AttachmentSettingsFace {
    hooks: {
        attachmentSettings: SnapshotStore<AttachmentSettingsState>;
    };
    edit(field: string, text: string): void;
    resetField(field: string): void;
    save(): void;
    discard(): void;
}
export declare class AttachmentSettingsController {
    private readonly scope;
    private readonly drafts;
    private readonly cleared;
    private readonly store;
    private saving;
    private failed;
    private readonly unsubscribe;
    constructor(scope: SettingsScope<DocumentAttachmentSettings>);
    dispose(): void;
    inject(): AttachmentSettingsFace;
    private save;
    private state;
    private publish;
}
type CardProps = PropsRuntime<'settings.plugin.item'> & InjectFace<AttachmentSettingsFace>;
export declare function DocumentAttachmentSettingsCard(props: CardProps): import("react").JSX.Element | null;
export {};
