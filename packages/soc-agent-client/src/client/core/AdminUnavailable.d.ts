import type { SocAdminRootProps } from '../contract.ts';
/** Safe admin-route fallback when the optional admin feature is disabled. */
export declare function AdminUnavailable({ renderSlot, connection, socClient }: SocAdminRootProps): import("react").JSX.Element;
