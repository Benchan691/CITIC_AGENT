import type { Context as ClientContext } from '@deepseek-ai/cordis';
export { SocActionPolicyMenu } from './SocActionPolicyMenu.tsx';
export { readActionMode } from './actionPolicy.ts';
/** Optional end-user access-mode chooser. */
export declare const inject: readonly ["slots", "socClient"];
export declare function apply(ctx: ClientContext): void;
