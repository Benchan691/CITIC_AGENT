import type { Context } from '@deepseek-ai/cordis';
import { type SnapshotStore } from '@deepseek-ai/dsh-client-store';
export interface SocAutoCollapseSnapshot {
    readonly enabled: boolean;
    readonly statusText: string;
}
export interface SocAutoCollapseRuntime {
    readonly state: SnapshotStore<SocAutoCollapseSnapshot>;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        socAutoCollapse: SocAutoCollapseRuntime;
    }
}
export declare const inject: string[];
export declare function apply(ctx: Context): void;
