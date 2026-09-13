/** CITIC/Sentinel occupants for the standard Harness brand slots. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { CiticBrandMark, CiticBrandName } from './CiticBrand.tsx';
/** Required services: the shared slot registry and mandatory SOC runtime. */
export declare const inject: readonly ["slots", "socClient"];
/** Fill the standard sidebar and conversation branding seats. */
export declare function apply(ctx: ClientContext): void;
