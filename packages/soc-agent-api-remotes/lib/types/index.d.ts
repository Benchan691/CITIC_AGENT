/** Host BFF entry and Loader shell for the Remote contribution assembly. */
import type { Context } from '@deepseek-ai/cordis';
export type {} from 'dsh-soc-agent-session-controller/types';
export { API_REMOTE_FORWARDED_EVENTS } from './remote-events.ts';
export type { ApiRemoteForwardedEvent } from './types.ts';
/** Required Host services: the Gateway transport and SOC request identity. */
export declare const inject: string[];
/** Host plugin body registering this application's selected Cordis event source. */
export declare function apply(ctx: Context): void;
