export const MODEL_PROVIDERS = {
  deepseek: { label: "DeepSeek", requiresApiKey: true },
  local: { label: "Local model", requiresApiKey: false },
} as const;

export type ModelChoice = keyof typeof MODEL_PROVIDERS;

export const DEFAULT_MODEL_CHOICE: ModelChoice =
  process.env.NEXT_PUBLIC_DEFAULT_MODEL_PROVIDER === "local"
    ? "local"
    : "deepseek";

export interface StandaloneConfig {
  deploymentUrl: string;
  assistantId: string;
  mcpServerUrl: string;
  activeAccountId?: string;
  accountApiKey?: string;
  langsmithApiKey?: string;
  defaultModelChoice?: ModelChoice;
}

export type ApprovalMode = "ask" | "smart" | "full";

export const DEFAULT_APPROVAL_MODE: ApprovalMode = "ask";

const APPROVAL_MODE_KEY = "deep-agent-thread-approval-modes";
const MODEL_CHOICE_KEY = "deep-agent-thread-models";
const NEW_THREAD_KEY = "__new__";

const CONFIG_KEY = "deep-agent-config";

export function getConfig(): StandaloneConfig | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(CONFIG_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function saveConfig(config: StandaloneConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function readApprovalModes(): Record<string, ApprovalMode> {
  if (typeof window === "undefined") return {};

  try {
    const stored = JSON.parse(localStorage.getItem(APPROVAL_MODE_KEY) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored))
      return {};
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([, value]) => value === "ask" || value === "smart" || value === "full"
      )
    ) as Record<string, ApprovalMode>;
  } catch {
    return {};
  }
}

function writeApprovalModes(modes: Record<string, ApprovalMode>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(APPROVAL_MODE_KEY, JSON.stringify(modes));
}

export function getApprovalMode(threadId?: string | null): ApprovalMode {
  return (
    readApprovalModes()[threadId || NEW_THREAD_KEY] || DEFAULT_APPROVAL_MODE
  );
}

export function saveApprovalMode(
  threadId: string | null | undefined,
  mode: ApprovalMode
): void {
  const modes = readApprovalModes();
  modes[threadId || NEW_THREAD_KEY] = mode;
  writeApprovalModes(modes);
}

export function removeApprovalMode(threadId: string): void {
  const modes = readApprovalModes();
  delete modes[threadId];
  writeApprovalModes(modes);
}

export function migrateNewThreadApprovalMode(threadId: string): ApprovalMode {
  const modes = readApprovalModes();
  const mode = modes[NEW_THREAD_KEY] || DEFAULT_APPROVAL_MODE;
  if (modes[NEW_THREAD_KEY]) {
    modes[threadId] = modes[NEW_THREAD_KEY];
    delete modes[NEW_THREAD_KEY];
    writeApprovalModes(modes);
  }
  return mode;
}

function readModelChoices(): Record<string, ModelChoice> {
  if (typeof window === "undefined") return {};

  try {
    const stored = JSON.parse(localStorage.getItem(MODEL_CHOICE_KEY) || "{}");
    if (!stored || typeof stored !== "object" || Array.isArray(stored))
      return {};
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([, value]) => value === "deepseek" || value === "local"
      )
    ) as Record<string, ModelChoice>;
  } catch {
    return {};
  }
}

function writeModelChoices(choices: Record<string, ModelChoice>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MODEL_CHOICE_KEY, JSON.stringify(choices));
}

export function getModelChoice(
  threadId?: string | null,
  fallback: ModelChoice = DEFAULT_MODEL_CHOICE
): ModelChoice {
  return readModelChoices()[threadId || NEW_THREAD_KEY] || fallback;
}

export function saveModelChoice(
  threadId: string | null | undefined,
  choice: ModelChoice
): void {
  const choices = readModelChoices();
  choices[threadId || NEW_THREAD_KEY] = choice;
  writeModelChoices(choices);
}

export function removeModelChoice(threadId: string): void {
  const choices = readModelChoices();
  delete choices[threadId];
  writeModelChoices(choices);
}

export function migrateNewThreadModelChoice(
  threadId: string,
  fallback: ModelChoice = DEFAULT_MODEL_CHOICE
): ModelChoice {
  const choices = readModelChoices();
  const choice = choices[NEW_THREAD_KEY] || fallback;
  if (choices[NEW_THREAD_KEY]) {
    choices[threadId] = choices[NEW_THREAD_KEY];
    delete choices[NEW_THREAD_KEY];
    writeModelChoices(choices);
  }
  return choice;
}
