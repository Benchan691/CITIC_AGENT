import "@deepseek-ai/dsh-llm";
import z from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
import "dsh-soc-agent-agent";
import "@deepseek-ai/dsh-session";
import { FileSystem, FsVersion } from "@deepseek-ai/dsh-fs";
//#region src/config.d.ts
/** User-facing workspace instruction loader configuration. */
interface Config {
  /** Harness home containing the fixed user-global `AGENTS.md`; defaults to `$DSH_HOME` or `~/.dsh`. */
  dshHome?: string;
  /** Directory entries that identify the project root while walking upward from the session cwd. */
  projectRootMarkers?: string[];
  /** UTF-8 byte cap for one rendered baseline or dynamic batch; non-positive or non-finite disables loading. */
  maxBytes: number;
  /** Maximum UTF-8 bytes read from one instruction file; larger files are ignored. */
  maxSourceBytes?: number;
  /**
   * Ordered same-directory project candidates; every existing file loads, with
   * per-directory trimmed-content duplicates collapsed to the earliest candidate.
   */
  instructionFileCandidates?: string[];
  /**
   * Ordered same-directory local-overlay candidates loaded after the base files
   * under the same per-directory trimmed-content dedup; empty disables the overlay.
   */
  localInstructionFileCandidates?: string[];
}
declare const Config: z<Config>;
//#endregion
//#region src/render.d.ts
/** Byte-accounting record for one truncated instruction file. */
interface TruncatedInstruction {
  displayPath: string;
  originalBytes: number;
  includedBytes: number;
}
/** Model-facing text plus omitted and truncated source records. */
interface RenderedWorkspaceContext {
  text: string;
  omitted: InstructionFile[];
  truncated: TruncatedInstruction[];
}
/** Structured dynamic state persisted outside model-visible prompt prose. */
interface AgentInstructionChange {
  action: 'set' | 'replace' | 'remove';
  scope: string;
  path: string;
  digest?: string;
}
/**
 * Render the baseline instruction chain with deterministic precedence budgeting.
 * @param files - loaded files ordered from broadest to most specific.
 * @param options - rendering byte budget and whether this baseline supersedes a visible predecessor.
 * @returns bounded baseline prompt text and budget diagnostics.
 */
declare function renderWorkspaceContext(files: LoadedInstructionFile[], options: {
  maxBytes: number;
  replacePreviousBaseline?: boolean;
}): RenderedWorkspaceContext;
//#endregion
//#region src/files.d.ts
/** An instruction candidate identified by absolute and model-facing paths. */
interface InstructionFile {
  absolutePath: string;
  displayPath: string;
}
/** An instruction file whose UTF-8 content was read successfully. */
interface LoadedInstructionFile extends InstructionFile {
  content: string;
  /** Provider freshness token when the file was loaded through `ctx.fs`. */
  version?: FsVersion;
}
interface DiscoverOptions {
  cwd: string;
  dshHome?: string;
  projectRootMarkers?: string[];
  instructionFileCandidates?: string[];
  localInstructionFileCandidates?: string[];
  projectRoot?: string;
  signal?: AbortSignal;
}
interface LoadOptions extends DiscoverOptions {
  maxBytes: number;
  maxSourceBytes?: number;
  replacePreviousBaseline?: boolean;
}
/**
 * Discover host-visible user-global and root-to-cwd instruction candidates.
 * All present candidates in each directory are returned; trimmed-content
 * duplicates are collapsed later, once content is read.
 * @param options - cwd, home, root marker, and candidate configuration.
 * @returns path-deduplicated instruction candidates in model precedence order.
 * @throws the original root-marker metadata error or cancellation reason when
 * discovery cannot identify the project root.
 */
declare function discoverBaselineInstructionFiles(options: DiscoverOptions): Promise<InstructionFile[]>;
/**
 * Discover, read, and render the baseline instruction chain.
 * @param options - discovery, source-size, byte-budget, and cancellation configuration.
 * @param fileSystem - optional provider used instead of host filesystem reads.
 * @returns rendered baseline context, or undefined when nothing can be loaded.
 * @throws the original root-marker metadata error or cancellation reason when
 * discovery cannot identify the project root.
 */
declare function loadBaselineInstructions(options: LoadOptions, fileSystem?: FileSystem): Promise<RenderedWorkspaceContext | undefined>;
//#endregion
//#region src/state.d.ts
declare const name = "agent-instructions";
/** Durable producer, file, and reconciliation facts for one workspace context. */
interface AgentInstructionSource {
  kind: 'agent-instructions';
  /** Every workspace context carries instructions read out of a file (the `instructions` context form). */
  form: 'instructions';
  /** Marks the complete startup/resume baseline rather than a later delta. */
  baseline?: true;
  /** Discovery, precedence, and budget identity used to validate a resumed baseline. */
  baselineIdentity?: string;
  changes: AgentInstructionChange[];
}
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'agent-instructions': AgentInstructionSource;
  }
}
//#endregion
//#region src/index.d.ts
/** Services required by workspace instruction projection. */
declare const inject: string[];
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, type InstructionFile, type LoadedInstructionFile, type RenderedWorkspaceContext, type TruncatedInstruction, apply, discoverBaselineInstructionFiles, inject, loadBaselineInstructions, name, renderWorkspaceContext };