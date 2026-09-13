import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SidebarBrandMarkOwnerProps } from 'dsh-soc-agent-sidebar/client';
type CiticBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps;
/** CITIC Telecom CPC's red emblem, adapted from the official logo artwork. */
export declare function CiticBrandMark({ size, className }: CiticBrandMarkProps): import("react").JSX.Element;
/** Sentinel wordmark shown next to the CITIC mark in the expanded sidebar. */
export declare function CiticBrandName(): import("react").JSX.Element;
export {};
