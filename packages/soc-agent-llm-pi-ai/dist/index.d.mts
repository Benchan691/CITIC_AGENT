import { GenerateOptions, ImageAttachmentAccess, LlmAdapter, LlmModelInfo, LlmProviderInfo, LlmResolvedModelInfo, PreparedAdapterCall, ResolvedRetryPolicy, RetryPolicyConfig, StreamChunk } from "@deepseek-ai/dsh-llm";
import { Api, AuthContext, CacheRetention, CredentialStore, Model, ModelThinkingLevel, OpenAICompletionsCompat, Provider, ThinkingBudgets, Transport } from "@earendil-works/pi-ai";
import z from "@deepseek-ai/schemastery";
import { CredentialKey, CredentialRef } from "@deepseek-ai/dsh-credentials";
import { Context } from "@deepseek-ai/cordis";
import { AttachmentStore, ImageAttachmentRef } from "@deepseek-ai/dsh-attachment";
//#region src/catalog.d.ts
/** One request modality a pi-ai model may accept. */
type PiAiModality = Model<Api>['input'][number];
/** One reasoning-dispatch wire format a profile may name. */
type PiAiThinkingFormat = NonNullable<OpenAICompletionsCompat['thinkingFormat']>;
/** The reasoning-budget field spellings pi-ai accepts. */
type PiAiThinkingTokenBudgetField = NonNullable<OpenAICompletionsCompat['thinkingTokenBudgetField']>;
/**
 * Selectable reasoning efforts for one model: each key is a level the model
 * offers (and selectors show), and its value is the wire spelling dispatch
 * sends for it. `off` alone may leave its value empty — "supported, send
 * nothing" — because for most providers not thinking is the parameter's
 * absence; every other declared level must name a wire value. A level absent
 * from the dict is not offered.
 */
type PiAiReasoningEfforts = Partial<Record<ModelThinkingLevel, string | null>>;
/**
 * pi-ai wire-compatibility switches, set on the route (its models' default) or
 * per model (winning over the route, field by field).
 *
 * pi-ai decides each of these from the provider id and baseURL when no layer
 * sets it, and a private gateway's URL says nothing: for an endpoint it does
 * not recognize the detection answers as though it were OpenAI itself, which
 * is wrong for most OpenAI-compatible gateways. So every field here is one a
 * deployment must be able to state because nothing can infer it, while the
 * fields pi-ai's catalog sets for a named vendor stay withheld.
 *
 * A field belongs to the protocols whose upstream compat type declares it: a
 * model-level switch its protocol does not take fails resolution, and a
 * route-level one skips past models it cannot fit. "The three Responses
 * protocols" below means `openai-responses`, `azure-openai-responses`, and
 * `openai-codex-responses`, which pi-ai gives one shared compat type, so a
 * switch settable on one is settable on all three.
 */
interface PiAiCompatProfile {
  /** Whether the endpoint accepts `store`; `openai-completions`. */
  supportsStore?: boolean;
  /**
   * Whether the endpoint accepts the `developer` role for the system prompt,
   * which pi-ai sends only to a reasoning model; `false` keeps `system`.
   * `openai-completions` and the three Responses protocols.
   */
  supportsDeveloperRole?: boolean;
  /** Whether the endpoint accepts `reasoning_effort`; `openai-completions`. */
  supportsReasoningEffort?: boolean;
  /** Whether the endpoint accepts `stream_options: {include_usage: true}`; `openai-completions`. */
  supportsUsageInStreaming?: boolean;
  /**
   * Whether streams include `finish_reason`; `false` lets pi-ai infer the
   * terminal reason when the stream ends; `openai-completions`.
   */
  supportsFinishReason?: boolean;
  /** Which output-cap field the endpoint reads; `openai-completions`. */
  maxTokensField?: NonNullable<OpenAICompletionsCompat['maxTokensField']>;
  /** Whether tool results must carry `name`; `openai-completions`. */
  requiresToolResultName?: boolean;
  /** Whether a user message after tool results needs an assistant message between; `openai-completions`. */
  requiresAssistantAfterToolResult?: boolean;
  /** Whether thinking blocks must travel as text in `<thinking>` delimiters; `openai-completions`. */
  requiresThinkingAsText?: boolean;
  /** Whether replayed assistant messages need an empty `reasoning_content` while reasoning is on; `openai-completions`. */
  requiresReasoningContentOnAssistantMessages?: boolean;
  /** Reasoning parameter format the endpoint expects; `openai-completions`. */
  thinkingFormat?: PiAiThinkingFormat;
  /**
   * Kwargs sent as `chat_template_kwargs`, which pi-ai reads only under the
   * two `chat-template` thinking formats; `openai-completions`. Nothing checks
   * that pairing: the format in force may come from the installed catalog
   * entry or from pi-ai's own baseURL detection, neither of which resolution
   * can read, so kwargs set beside another format are sent nowhere.
   */
  chatTemplateKwargs?: NonNullable<OpenAICompletionsCompat['chatTemplateKwargs']>;
  /** Arguments sent as `chat_template_args` under the `baseten` thinking format; `openai-completions`. */
  chatTemplateArgs?: NonNullable<OpenAICompletionsCompat['chatTemplateArgs']>;
  /** Alias for `thinkingTokenBudgetField: "thinking_token_budget"`; an explicit field wins. `openai-completions`. */
  supportsThinkingTokenBudget?: boolean;
  /** Request field carrying the reasoning budget from `thinkingBudgets`; omitted unless configured. `openai-completions`. */
  thinkingTokenBudgetField?: PiAiThinkingTokenBudgetField;
  /** vLLM scheduler `priority`; lower runs earlier, and the server must enable priority scheduling. Omitted unless configured. */
  vllmPriority?: number;
  /** Whether `openai-responses` accepts `max_output_tokens`; `false` omits it. Azure and Codex ignore this shared compat field. */
  supportsMaxOutputTokens?: boolean;
  /**
   * Whether the endpoint accepts `strict` in tool definitions;
   * `openai-completions`, the three Responses protocols, `bedrock-converse-stream`.
   */
  supportsStrictMode?: boolean;
  /** Prompt-cache marker convention; `openai-completions`. */
  cacheControlFormat?: NonNullable<OpenAICompletionsCompat['cacheControlFormat']>;
  /**
   * Whether the endpoint accepts long prompt-cache retention;
   * `openai-completions`, the three Responses protocols, `anthropic-messages`.
   */
  supportsLongCacheRetention?: boolean;
  /** Whether the endpoint accepts per-tool `eager_input_streaming`; `anthropic-messages`. */
  supportsEagerToolInputStreaming?: boolean;
  /** Whether the endpoint accepts `cache_control` on tool definitions; `anthropic-messages`. */
  supportsCacheControlOnTools?: boolean;
  /** Whether the endpoint accepts the `temperature` request field; `anthropic-messages`. */
  supportsTemperature?: boolean;
  /** Whether to force adaptive thinking regardless of model id; `anthropic-messages`. */
  forceAdaptiveThinking?: boolean;
  /** Whether to replay an empty thinking signature instead of converting thinking to text; `anthropic-messages`. */
  allowEmptySignature?: boolean;
  /** Whether the endpoint accepts Anthropic strict tool schemas; `anthropic-messages`. */
  supportsStrictTools?: boolean;
}
/** One configured model entry: an id plus the catalog fields it overrides. */
interface PiAiModelProfile {
  /** Model id sent to the provider and accepted by {@link GenerateOptions.model}. */
  id: string;
  /** Display name for selectors; defaults to the catalog name, then the id. */
  name?: string;
  /** Maximum combined request and response context in tokens. */
  contextWindow?: number;
  /**
   * Maximum output tokens. Configuring one also makes it this model's
   * per-request default; a value inherited from the installed catalog, or the
   * route's fallback, is the model's capability and never becomes a request
   * default on its own.
   */
  maxTokens?: number;
  /**
   * Request modalities this model accepts. Absent — or empty, which describes
   * a model that accepts nothing and so states no answer either — keeps the
   * installed catalog entry's modalities, then the route's `defaultInput`.
   * Declaring images is what makes a hand-declared vision model usable, and
   * declaring text alone corrects a catalog model whose gateway does not serve
   * what the catalog records. This is a claim about the endpoint, not a check
   * of it: nothing interrogates a gateway for what it accepts, so a model
   * claiming images its endpoint refuses is refused by the provider instead,
   * mid-turn.
   */
  input?: PiAiModality[];
  /**
   * Selectable reasoning efforts. Absent inherits the installed catalog
   * entry's capability (a hand-declared model has none and does not reason);
   * `false` declares a non-reasoning model, which is how a profile strips
   * reasoning from a catalog model its gateway cannot serve; a non-empty dict
   * declares the offered levels and their wire spellings.
   */
  reasoningEfforts?: false | PiAiReasoningEfforts;
  /** pi-ai wire-compatibility switches for this model, winning over the route's per field; one its protocol does not declare is refused. */
  compat?: PiAiCompatProfile;
}
/**
 * Customization of one installed catalog model, keyed by its id in the
 * route's `modelOverrides` dict — the same fields a `models` entry may set,
 * with the id living in the key. Unlike a `models` list, overrides leave the
 * rest of the catalog serving untouched, which is what makes "correct one
 * model, keep the other thirty-seven" a three-line edit.
 */
type PiAiModelOverride = Omit<PiAiModelProfile, 'id'>;
//#endregion
//#region src/config.d.ts
/** Configuration for one pi-ai provider route; the `providers` dict key IS the route. */
interface PiAiProviderProfile {
  /** Credential reference (environment-variable name) resolved per request through `ctx.credentials`. */
  apiKeyEnv?: string;
  /** Name shown by configuration surfaces; defaults to the route key. */
  displayName?: string;
  /**
   * Wire protocol every model on this route speaks. Omission keeps each
   * installed catalog model's own protocol, which is why a catalog route needs
   * no protocol at all; a route the catalog does not ship must name one.
   */
  api?: string;
  /** Endpoint for this route's models; defaults to the installed catalog's endpoint. */
  baseURL?: string;
  /**
   * This route's model catalog. Omission serves the installed catalog for the
   * route unchanged; an explicit list replaces it, each entry defaulting its
   * unset fields from the installed model of the same id.
   */
  models?: PiAiModelProfile[];
  /**
   * Installed-catalog customizations by model id: each entry reshapes that
   * one model with the same fields a {@link models} entry takes, while the
   * rest of the catalog keeps serving untouched. Only meaningful on a catalog
   * route with no `models` list — `models` already replaces the catalog, so
   * an override beside it, on a route the catalog does not ship, or naming a
   * model the catalog does not describe is refused rather than skipped.
   */
  modelOverrides?: Record<string, PiAiModelOverride>;
  /**
   * pi-ai wire-compatibility switches defaulting every model on this route
   * whose protocol declares them; each model's own `compat` overrides per
   * field. What neither sets keeps the installed catalog entry's value, then
   * pi-ai's own detection. A switch no model on the route could read is
   * refused rather than left looking applied.
   */
  compat?: PiAiCompatProfile;
  /**
   * Context capacity for a model this route lists that neither the entry nor
   * the installed catalog sizes (default 262,144). A guess by construction, so
   * a deployment whose gateway serves smaller models corrects it here.
   */
  defaultContextWindow?: number;
  /**
   * Output capability for a model this route lists that neither the entry nor
   * the installed catalog sizes (default 32,768). This sizes the model; it
   * never becomes a per-request cap on its own.
   */
  defaultMaxTokens?: number;
  /**
   * Request modalities for a model this route lists that neither its entry's
   * {@link PiAiModelProfile.input} nor the installed catalog declares (default
   * `[text]`). A fallback like the capacities above, not an override: a
   * catalog model keeps the modalities the catalog records for it, and this
   * value never narrows one. A gateway serving vision models the catalog does
   * not describe declares `[text, image]` once here instead of on every entry.
   * Unlike an entry's list, this one may not be empty — nothing sits below it
   * to answer instead.
   */
  defaultInput?: PiAiModality[];
  /** Provider request headers, validated against Fetch when the profile resolves; Harness attribution wins reserved names. */
  headers?: Record<string, string>;
  /** Provider-neutral pi-ai reasoning level. */
  reasoning?: ModelThinkingLevel;
  /** Token budgets used by reasoning providers that support them. */
  thinkingBudgets?: ThinkingBudgets;
  /** Prompt-cache retention preference. */
  cacheRetention?: CacheRetention;
  /** Streaming transport preference. */
  transport?: Transport;
  /** HTTP/provider SDK timeout in milliseconds. */
  timeoutMs?: number;
  /** WebSocket connection timeout in milliseconds. */
  websocketConnectTimeoutMs?: number;
  /** Maximum provider idle time while one stream read is outstanding. */
  streamIdleTimeoutMs?: number;
  /**
   * Maximum base64-encoded image payload per request. When a request's
   * accumulated images exceed it, the oldest images are replaced by text
   * placeholders until the request fits, so a long session keeps completing
   * requests instead of being rejected by a request-size cap.
   */
  maxRequestImageBytes?: number;
  /** Total-pixel budget for each deterministic inline request version. */
  requestImagePixelBudget?: number;
  /**
   * Raw encoded-byte target for each deterministic inline request version;
   * the smallest quality-ladder output is used when no quality fits.
   */
  requestImageMaxBytes?: number;
  /** Provider-owned model-request retry policy; omission uses normal mode with five retries. */
  retryPolicy?: RetryPolicyConfig;
}
/** Validated profile with its route stamped and every adapter-owned default resolved. */
interface ResolvedPiAiProviderProfile extends Omit<PiAiProviderProfile, 'apiKeyEnv' | 'retryPolicy' | 'models' | 'displayName'> {
  /** Harness route key and the `Models` collection key (the configuration dict key). */
  provider: string;
  /** Resolved display name for selectors and configuration surfaces. */
  displayName: string;
  /** Validated credential reference, when one is configured. */
  apiKeyEnv?: CredentialRef;
  /** Positive finite provider-idle interval after defaulting. */
  streamIdleTimeoutMs: number;
  /** Positive request-level base64 image payload bound after defaulting. */
  maxRequestImageBytes: number;
  /** Positive total-pixel request-version budget after defaulting. */
  requestImagePixelBudget: number;
  /** Positive raw request-version byte target after defaulting; the smallest quality-ladder output is used when no quality fits. */
  requestImageMaxBytes: number;
  /** Immutable retry policy captured with this provider route. */
  retryPolicy: ResolvedRetryPolicy;
  /**
   * The pi-ai provider containing this route's serviceable models. Absent when
   * a stored route cannot be constructed; its configuration remains editable.
   */
  piProvider?: Provider;
  /** First model diagnostic, or the route failure when no model diagnostic is available. */
  catalogError?: string;
  /** Per-model failures reported before attempting a request. */
  modelErrors: ReadonlyMap<string, string>;
  /**
   * Per-request output caps this profile explicitly configured, by model id.
   * The seam materializes one only into a request that names no cap of its
   * own, so a catalog capability must not appear here.
   */
  configuredMaxTokens: ReadonlyMap<string, number>;
}
/** Plugin configuration: the provider routes this instance owns. */
interface Config {
  /**
   * pi-ai provider routes, keyed by provider. An empty (or omitted) dict is
   * the dormant settings-driven posture: the adapter mounts with no routes
   * and registers them the moment a settings section supplies profiles.
   */
  providers?: Record<string, PiAiProviderProfile>;
}
/** Runtime schema for {@link Config}. */
declare const Config: z<Config>;
//#endregion
//#region src/adapter.d.ts
/** Constructor options for {@link PiAiAdapter}: the two resolution hooks the plugin owns. */
interface PiAiAdapterOptions {
  /** Current validated profiles by provider route; called once per operation. */
  profiles: () => ReadonlyMap<string, ResolvedPiAiProviderProfile>;
  /**
   * Resolve the credential for one already-resolved profile; called once per
   * stream call and frozen for that call. `undefined` defers to the route's own
   * pi-ai auth, which for an installed catalog route is its provider-native
   * ambient discovery; the plugin allows that only for a profile naming no
   * credential at all, because a named reference that misses throws `LlmError`
   * `MISSING_CREDENTIAL` rather than falling back.
   */
  resolveApiKey: (provider: string, profile: ResolvedPiAiProviderProfile) => Promise<string | undefined>;
  /**
   * How every collection this adapter builds resolves auth the request-level
   * `apiKey` override does not cover. Required rather than optional: a
   * collection built without them gets pi-ai's in-memory default store, which
   * is empty at every boot and discarded on every configuration change, so a
   * route whose only method is a login would report itself unconfigured on
   * every request no matter how often the human signed in.
   */
  auth: PiAiAuthInjection;
  /** Resolve the optional durable attachment service at request time. */
  resolveAttachments?: () => AttachmentStore | undefined;
  /** Bridge one attachment reference into the current model-tool execution world. */
  resolveImageAccess?: (attachments: AttachmentStore, ref: ImageAttachmentRef) => ImageAttachmentAccess | undefined;
  /**
   * Observe one assistant history message degrading to provider-neutral
   * conversion because its stored replay state is unusable by this build.
   */
  onReplayDegrade?: (detail: {
    provider: string;
    model: string;
    reason: string;
  }) => void;
}
/** The two auth injectables a pi-ai collection is built with. */
interface PiAiAuthInjection {
  /** Durable storage for credentials pi-ai itself writes: logins, and the refreshes it runs under its own lock. */
  credentials: CredentialStore;
  /** Ambient lookups a provider performs while resolving its own auth. */
  authContext: AuthContext;
}
/**
 * pi-ai-backed multi-provider adapter. Each operation reads the current
 * profiles, so a configuration change reaches the next request without a
 * restart; model descriptors come from the collection those profiles built.
 */
declare class PiAiAdapter extends LlmAdapter {
  private readonly config;
  private snapshot;
  constructor(config: PiAiAdapterOptions);
  /**
   * The snapshot for the current profiles. Resolution memoizes its result, so
   * an unchanged configuration is recognized by identity; a changed one gets a
   * brand-new collection, leaving any snapshot an operation already captured
   * untouched for as long as that operation holds it.
   */
  private current;
  /** The profile for one route within one snapshot, or the not-owned failure. */
  private profileOf;
  /** The configured descriptor for one exact route/model pair within one snapshot. */
  private modelOf;
  providerInfo(provider: string): LlmProviderInfo;
  providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined;
  listModels(provider: string): Promise<readonly LlmModelInfo[]>;
  resolveModel(provider: string, model: string, _signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
  private modelInfo;
  prepareCall(provider: string, model: string, _signal?: AbortSignal): Promise<PreparedAdapterCall>;
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
  private streamWithSnapshot;
}
//#endregion
//#region src/auth.d.ts
/**
 * The record address for one pi-ai provider id.
 * @param providerId - pi-ai's own provider id, which is also the harness route key.
 * @returns the scoped credential key this adapter family reads and writes.
 */
declare function recordKeyFor(providerId: string): CredentialKey;
//#endregion
//#region src/provider.d.ts
/**
 * Every wire protocol a configured route may name, most-reached first. The
 * order is the table's and therefore stable; a configuration surface offering
 * a choice presents the first as its default, which is why the protocol a
 * hand-declared gateway most often speaks — and the one endpoint interrogation
 * can read — leads.
 * @returns the supported protocol identifiers.
 */
declare function supportedProtocols(): readonly string[];
//#endregion
//#region src/index.d.ts
declare const name = "llm-pi-ai";
declare const inject: string[];
/** Register one generic pi-ai adapter for all configured provider routes. */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { Config, PiAiAdapter, type PiAiAdapterOptions, type PiAiCompatProfile, type PiAiModality, type PiAiModelOverride, type PiAiModelProfile, type PiAiProviderProfile, type PiAiReasoningEfforts, type PiAiThinkingFormat, type ResolvedPiAiProviderProfile, apply, inject, name, recordKeyFor, supportedProtocols };