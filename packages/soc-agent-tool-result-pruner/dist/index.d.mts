import { Context, Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { ContentBlock, ToolCallId } from "@deepseek-ai/dsh-llm";
import { Session } from "@deepseek-ai/dsh-session";
import { SessionSeq } from "@deepseek-ai/dsh-session/types";
//#region src/types.d.ts
/** Character-budget policy for deterministic tool-result pruning. */
interface ToolResultPruneConfig {
  /** Prune when total text exceeds this many Unicode code points. Defaults to `8192`. */
  thresholdChars?: number;
  /** Maximum leading Unicode code points retained. Defaults to `4096`. */
  headChars?: number;
  /** Maximum trailing Unicode code points retained. Defaults to `1024`. */
  tailChars?: number;
}
/** Validated, detached, deeply immutable pruning configuration. */
interface ResolvedConfig {
  readonly thresholdChars: number;
  readonly headChars: number;
  readonly tailChars: number;
}
/** Cited source event and size accounting for one landed surface replacement. */
interface PrunedEntry {
  /** Full-fidelity tool-result event shadowed by the replacement. */
  readonly originalSeq: SessionSeq;
  /** Newly appended pruned tool-result event. */
  readonly replacementSeq: SessionSeq;
  /** Tool call shared by the original and replacement. */
  readonly callId: ToolCallId;
  /** Original text size in Unicode code points. */
  readonly charsBefore: number;
  /** Replacement text size in Unicode code points. */
  readonly charsAfter: number;
}
/** Aggregate outcome of one stable-surface pruning pass. */
interface PruneResult {
  /** Replacements in the snapshotted surface order. */
  readonly pruned: readonly PrunedEntry[];
  /** Total Unicode code points removed across replacements. */
  readonly charsRemoved: number;
}
//#endregion
//#region src/config.d.ts
/** Fixed marker substituted for every removed middle span. */
declare const PRUNE_MARKER = "\n\n[... tool result middle pruned ...]\n\n";
/** Low-friction defaults for coding-agent tool output. */
declare const DEFAULTS: ResolvedConfig;
/**
 * Count Unicode code points without splitting surrogate pairs.
 * @param text - text to measure.
 * @returns the Unicode code-point count.
 */
declare function codePointLength(text: string): number;
/**
 * Resolve and validate pruning budgets.
 * @param config - raw plugin configuration.
 * @returns a detached deeply immutable configuration.
 */
declare function resolveConfig(config?: ToolResultPruneConfig): ResolvedConfig;
//#endregion
//#region src/index.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    toolResultPruner: ToolResultPruner;
  }
}
/** Deterministic head/middle/tail pruning for current tool-result surface nodes. */
declare class ToolResultPruner extends Service {
  static inject: string[];
  static Config: z<ToolResultPruneConfig>;
  /** Resolved and immutable character budgets. */
  readonly config: ResolvedConfig;
  constructor(ctx: Context, config?: ToolResultPruneConfig);
  /**
   * Measure text content in Unicode code points; non-text blocks cost zero.
   * @param blocks - tool-result content to measure.
   * @returns total Unicode code points across text blocks.
   */
  measureContent(blocks: readonly ContentBlock[]): number;
  /**
   * Replace an over-budget text middle while retaining rich-block order.
   * Text slicing is by Unicode code point, not UTF-16 code unit, so a retained
   * boundary cannot split a surrogate pair. Grapheme clusters may still split.
   * @param blocks - original tool-result content.
   * @returns pruned content, or `null` when the text is within budget.
   */
  pruneContent(blocks: readonly ContentBlock[]): ContentBlock[] | null;
  /**
   * Prune every over-budget tool result from one stable current-surface snapshot.
   * Each replacement preserves the complete event data except for `content`,
   * cites the shadowed node so replay can recover the replacement input, and is
   * immediately preceded by a `compaction/prune` shadow-price event pricing the
   * shadowed node through the injected token meter, so pure consumers can
   * subtract it without per-node state.
   * @param session - session whose current surface is rewritten.
   * @returns landed replacements and aggregate Unicode-code-point savings.
   * @throws when the session rejects a replacement; replacements committed
   * earlier in the pass remain durable.
   */
  pruneSession(session: Session): PruneResult;
}
//#endregion
export { DEFAULTS, PRUNE_MARKER, type PruneResult, type PrunedEntry, type ResolvedConfig, type ToolResultPruneConfig, ToolResultPruner, ToolResultPruner as default, codePointLength, resolveConfig };