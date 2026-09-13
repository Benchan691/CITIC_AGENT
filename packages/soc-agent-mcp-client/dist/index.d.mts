import z from "@deepseek-ai/schemastery";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Context } from "@deepseek-ai/cordis";
//#region src/connection.d.ts
/** Automatic reconnect policy for one MCP server connection. */
interface ReconnectConfig {
  /** Reconnect automatically after a lost connection (default true). */
  enabled?: boolean;
  /** First reconnect delay in milliseconds; doubles per consecutive failed attempt (default 500). */
  initialDelayMs?: number;
  /** Backoff ceiling in milliseconds; also the uptime after which the attempt budget resets (default 30000). */
  maxDelayMs?: number;
  /** Consecutive failed attempts per outage before giving up for good (default 10). */
  maxAttempts?: number;
}
/** Fully resolved reconnect policy captured at plugin load. */
type ResolvedReconnectPolicy = Readonly<Required<ReconnectConfig>>;
//#endregion
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-util-values@0.1.5-rc.2_@deepseek-ai+cordis@4.0.2/node_modules/@deepseek-ai/dsh-util-values/lib/types/index.d.ts
/** Duplicate-install-safe JSON and immutable-value helpers. @module @deepseek-ai/dsh-util-values */
/** A value that round-trips through JSON without loss. */
type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};
//#endregion
//#region src/tools.d.ts
/** Canonical MCP result exposed to PTC mode without discarding protocol blocks. */
type McpResult<Structured extends JsonValue = JsonValue> = {
  content: JsonValue[];
  structuredContent?: Structured;
};
//#endregion
//#region src/index.d.ts
/** Cordis plugin name used by loader diagnostics. */
declare const name = "mcp-client";
/** Services required by this plugin. */
declare const inject: string[];
/** Config for connecting to an MCP server via a spawned child process over stdio. */
interface StdioConfig {
  /** Selects child-process stdio transport. */
  transport: 'stdio';
  /**
   * Stable local namespace for this server's model-facing tool names
   * (`mcp__<serverName>__<rawName>`). Must match `[A-Za-z0-9_-]{1,32}` and be
   * unique across live mcp-client instances.
   */
  serverName: string;
  /** Executable used to start the server. */
  command: string;
  /** Arguments passed directly, without shell interpolation. */
  args: string[];
  /** Extra env vars merged on top of scrubbed ambient env. */
  env: Record<string, string>;
  /** Working directory for the child process. */
  cwd: string;
  /** Per-tool-call timeout in milliseconds. */
  toolCallTimeoutMs: number;
  /** Fail plugin activation when the initial connection or tool synchronization fails. */
  failOnStartupError: boolean;
  /** Automatic reconnect policy after a lost connection; omission uses the defaults. */
  reconnect?: ReconnectConfig;
}
/** Config for connecting to an MCP server over Streamable HTTP (SSE). */
interface StreamableHttpConfig {
  /** Selects Streamable HTTP transport. */
  transport: 'streamable-http';
  /**
   * Stable local namespace for this server's model-facing tool names
   * (`mcp__<serverName>__<rawName>`). Must match `[A-Za-z0-9_-]{1,32}` and be
   * unique across live mcp-client instances.
   */
  serverName: string;
  /** MCP endpoint URL. */
  url: string;
  /** Additional headers attached to MCP requests. */
  headers: Record<string, string>;
  /** Per-tool-call timeout in milliseconds. */
  toolCallTimeoutMs: number;
  /** Fail plugin activation when the initial connection or tool synchronization fails. */
  failOnStartupError: boolean;
  /** Automatic reconnect policy after a lost connection; omission uses the defaults. */
  reconnect?: ReconnectConfig;
}
/** Configuration for one stdio or Streamable HTTP MCP server. */
type Config = StdioConfig | StreamableHttpConfig;
type StdioConfigInput = Omit<StdioConfig, 'args' | 'env' | 'cwd' | 'toolCallTimeoutMs' | 'failOnStartupError'> & Partial<Pick<StdioConfig, 'args' | 'env' | 'cwd' | 'toolCallTimeoutMs' | 'failOnStartupError'>>;
type StreamableHttpConfigInput = Omit<StreamableHttpConfig, 'headers' | 'toolCallTimeoutMs' | 'failOnStartupError'> & Partial<Pick<StreamableHttpConfig, 'headers' | 'toolCallTimeoutMs' | 'failOnStartupError'>>;
type ConfigInput = StdioConfigInput | StreamableHttpConfigInput;
declare const Config: z<ConfigInput, Config>;
/**
 * Connect one MCP server and publish its initial tool generation before activation.
 * This entry remains explicitly `async`: Cordis treats a prototype-bearing
 * ordinary function as a constructor, whose returned Promise is not startup work.
 * @param ctx - plugin context carrying the tool registry.
 * @param config - resolved transport and server namespace configuration.
 * @returns startup readiness after connection and initial tool discovery settle.
 */
declare function apply(ctx: Context, config: Config): Promise<void>;
//#endregion
export { Config, type McpResult, type ReconnectConfig, type ResolvedReconnectPolicy, StdioConfig, StreamableHttpConfig, apply, inject, name };