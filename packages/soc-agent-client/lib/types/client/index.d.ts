import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export type { SocAdminContentOwnerProps, SocAdminRootProps, SocClientRuntime } from './contract.ts';
export { createSocClientRuntime, socSurface, SOC_CONFIG_CHANNEL } from './contract.ts';
export type { SocActionApprovalSettings, SocActionMode, SocActionState, } from '../core/action-approval-settings.ts';
export declare const inject: readonly ["slots", "connection"];
export declare function apply(ctx: ClientContext): void;
