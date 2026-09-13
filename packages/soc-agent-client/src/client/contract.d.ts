import type { ConnectionHandle } from 'dsh-soc-agent-connection/client';
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots';
/** Shared RPC channel owned by the SOC host plugin. */
export declare const SOC_CONFIG_CHANNEL = "/soc-agent-config";
/**
 * Browser-facing SOC client contract. Feature plugins use this service for
 * product RPCs and for the current surface; they do not reach into the
 * monolithic client bundle.
 */
export interface SocClientRuntime {
    readonly surface: 'workspace' | 'admin';
    rpc<T = unknown>(name: string, payload?: Record<string, unknown>): Promise<T>;
}
/** Resolve the SOC surface from the browser pathname. Kept pure for route tests. */
export declare function socSurface(pathname: string): SocClientRuntime['surface'];
/** Build the shared browser RPC service over the authenticated connection. */
export declare function createSocClientRuntime(connection: Pick<ConnectionHandle, 'rpc'>, surface: SocClientRuntime['surface']): SocClientRuntime;
/** Props passed from the core admin root to the optional admin feature. */
export interface SocAdminContentOwnerProps {
    connection: ConnectionHandle;
    socClient: SocClientRuntime;
}
/** Props for the core-owned admin content root. */
export type SocAdminRootProps = SocAdminContentOwnerProps & PropsRenderSlots<'soc.admin.content'>;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        /** Optional SOC administration application rendered by the core fallback root. */
        'soc.admin.content': {
            kind: 'single';
            scope: 'root';
            owner: SocAdminContentOwnerProps;
        };
    }
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Shared SOC client contract for optional browser feature plugins. */
        socClient: SocClientRuntime;
    }
}
