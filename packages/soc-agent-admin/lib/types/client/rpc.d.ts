import type { SocClientRuntime } from 'dsh-soc-agent-client/client';
export declare function errorText(error: unknown): string;
export declare function rpc<T = unknown>(client: SocClientRuntime, name: string, payload?: Record<string, unknown>): Promise<T>;
