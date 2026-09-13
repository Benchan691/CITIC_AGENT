import type { Context as ClientContext } from '@deepseek-ai/cordis';
export { AdminConsole } from './AdminConsole.tsx';
export { validCatalog } from './SocActionApprovalSettings.tsx';
export type { SocAction } from './SocActionApprovalSettings.tsx';
/** The complete optional administration surface. */
export declare const inject: readonly ["slots", "socClient", "remote"];
export declare function apply(ctx: ClientContext): void;
