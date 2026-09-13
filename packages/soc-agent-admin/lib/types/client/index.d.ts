import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { AdminConsole } from './AdminConsole.tsx';
export { validCatalog } from './SocActionApprovalSettings.tsx';
export type { SocAction } from './SocActionApprovalSettings.tsx';
/** The complete optional administration surface. */
export declare const inject: readonly ["slots", "socClient"];
export declare function apply(ctx: ClientContext): void;
