/**
 * Immutable dsh-v0.1.5-rc.2 implementation forks owned by the SOC product.
 * Generic contracts intentionally do not appear here and continue to resolve
 * from the official release packages.
 */
export const upstream = Object.freeze({
  repository: 'https://github.com/deepseek-ai/deepseek-harness.git',
  tag: 'dsh-v0.1.5-rc.2',
  commit: 'fb2c4b9e698e30edb738bca4cf0618587db7d203',
  version: '0.1.5-rc.2',
})

export const replacements = Object.freeze([
  ['packages/api/gateway', '@deepseek-ai/dsh-api-gateway', 'soc-agent-api-gateway', 'dsh-soc-agent-api-gateway'],
  ['packages/core/agent', '@deepseek-ai/dsh-agent', 'soc-agent-agent', 'dsh-soc-agent-agent'],
  ['packages/core/agent-loop', '@deepseek-ai/dsh-agent-loop', 'soc-agent-agent-loop', 'dsh-soc-agent-agent-loop'],
  ['packages/settings/settings-file', '@deepseek-ai/dsh-settings-file', 'soc-agent-settings-file', 'dsh-soc-agent-settings-file'],
  ['packages/llm/llm-pi-ai', '@deepseek-ai/dsh-llm-pi-ai', 'soc-agent-llm-pi-ai', 'dsh-soc-agent-llm-pi-ai'],
  ['packages/session/session-persistence-jsonl', '@deepseek-ai/dsh-session-persistence-jsonl', 'soc-agent-session-persistence-jsonl', 'dsh-soc-agent-session-persistence-jsonl'],
  ['packages/context/agent-instructions', '@deepseek-ai/dsh-agent-instructions', 'soc-agent-agent-instructions', 'dsh-soc-agent-agent-instructions'],
  ['packages/compaction/compaction-tool-result-pruner', '@deepseek-ai/dsh-compaction-tool-result-pruner', 'soc-agent-tool-result-pruner', 'dsh-soc-agent-tool-result-pruner'],
  ['packages/context/time-context', '@deepseek-ai/dsh-time-context', 'soc-agent-time-context', 'dsh-soc-agent-time-context'],
  ['packages/mcp/mcp-client', '@deepseek-ai/dsh-mcp-client', 'soc-agent-mcp-client', 'dsh-soc-agent-mcp-client'],
  ['packages/client/connection', '@deepseek-ai/dsh-client-connection', 'soc-agent-connection', 'dsh-soc-agent-connection'],
  ['packages/client/file-upload', '@deepseek-ai/dsh-client-file-upload', 'soc-agent-file-upload', 'dsh-soc-agent-file-upload'],
  ['packages/api/remotes', '@deepseek-ai/dsh-api-remotes', 'soc-agent-api-remotes', 'dsh-soc-agent-api-remotes'],
  ['packages/api/session-controller', '@deepseek-ai/dsh-api-session-controller', 'soc-agent-session-controller', 'dsh-soc-agent-session-controller'],
  ['packages/api/workspace-controller', '@deepseek-ai/dsh-api-workspace-controller', 'soc-agent-workspace-controller', 'dsh-soc-agent-workspace-controller'],
  ['packages/api/workspace-files', '@deepseek-ai/dsh-api-workspace-files', 'soc-agent-api-workspace-files', 'dsh-soc-agent-api-workspace-files'],
  ['packages/api/settings-controller', '@deepseek-ai/dsh-api-settings-controller', 'soc-agent-api-settings-controller', 'dsh-soc-agent-api-settings-controller'],
  ['packages/session-query/session-log-export', '@deepseek-ai/dsh-session-log-export', 'soc-agent-session-log-export', 'dsh-soc-agent-session-log-export'],
  ['packages/client/ui-layout', '@deepseek-ai/dsh-client-ui-layout', 'soc-agent-ui-layout', 'dsh-soc-agent-ui-layout'],
  ['packages/client/ui-renderer', '@deepseek-ai/dsh-client-ui-renderer', 'soc-agent-ui-renderer', 'dsh-soc-agent-ui-renderer'],
  ['packages/client/ui-session', '@deepseek-ai/dsh-client-ui-session', 'soc-agent-ui-session', 'dsh-soc-agent-ui-session'],
  ['packages/client/ui-sidebar', '@deepseek-ai/dsh-client-ui-sidebar', 'soc-agent-sidebar', 'dsh-soc-agent-sidebar'],
  ['packages/client/ui-workspace', '@deepseek-ai/dsh-client-ui-workspace', 'soc-agent-workspace', 'dsh-soc-agent-workspace'],
  ['packages/client/ui-conversation', '@deepseek-ai/dsh-client-ui-conversation', 'soc-agent-ui-conversation', 'dsh-soc-agent-ui-conversation'],
  ['packages/client/ui-chat', '@deepseek-ai/dsh-client-ui-chat', 'soc-agent-ui-chat', 'dsh-soc-agent-ui-chat'],
  ['packages/client/ui-approval', '@deepseek-ai/dsh-client-ui-approval', 'soc-agent-ui-approval', 'dsh-soc-agent-ui-approval'],
  ['packages/client/ui-commands', '@deepseek-ai/dsh-client-ui-commands', 'soc-agent-ui-commands', 'dsh-soc-agent-ui-commands'],
  ['packages/client/ui-input-trigger', '@deepseek-ai/dsh-client-ui-input-trigger', 'soc-agent-ui-input-trigger', 'dsh-soc-agent-ui-input-trigger'],
  ['packages/client/ui-model-selection', '@deepseek-ai/dsh-client-ui-model-selection', 'soc-agent-ui-model-selection', 'dsh-soc-agent-ui-model-selection'],
  ['packages/client/ui-attachment', '@deepseek-ai/dsh-client-ui-attachment', 'soc-agent-attachments', 'dsh-soc-agent-attachments'],
  ['packages/client/ui-brand-official', '@deepseek-ai/dsh-client-ui-brand-official', 'soc-agent-brand', 'dsh-soc-agent-brand'],
].map(([sourcePath, officialName, packageDir, socName]) => Object.freeze({
  sourcePath, officialName, packageDir, socName,
})))

export const replacementNames = new Map(replacements.map(row => [row.officialName, row.socName]))
