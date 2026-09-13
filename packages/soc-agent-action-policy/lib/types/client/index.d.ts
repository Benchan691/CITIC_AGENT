import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { SocActionPolicyMenu } from './SocActionPolicyMenu.tsx';
export { readActionMode } from './actionPolicy.ts';
/** Optional end-user access-mode chooser. */
export declare const inject: readonly ["slots", "socClient"];
export declare function apply(ctx: ClientContext): void;
