import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
interface Props {
    connection: ConnectionHandle;
}
/** User-scoped report profiles use their own authenticated settings channel. */
export declare function CustomerReportSettingsCard({ connection }: Props): import("react").JSX.Element;
export {};
