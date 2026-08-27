// These stock Web tests exercise surfaces deliberately removed from the SOC
// composition. Keep the exclusion list centralized and reversible: the
// underlying tests remain useful for the upstream Web product, but they are
// not valid SOC acceptance gates.
export const SOC_UNSUPPORTED_WEB_TESTS = Object.freeze([
  // Logical folders are replaced by private physical workspaces and a
  // protected General workspace.
  'apps/web/tests/workspace-management.e2e.ts',

  // The SOC patch disables the corresponding tool/UI surfaces.
  'apps/web/tests/access-confirmation.e2e.ts',
  'apps/web/tests/approval-composer.e2e.ts',
  'apps/web/tests/agent-preset-authoring.e2e.ts',
  'apps/web/tests/agent-preset-selection.e2e.ts',
  'apps/web/tests/background-job-list.e2e.ts',
  'apps/web/tests/bash-abort-row.e2e.ts',
  'apps/web/tests/built-boot.snapshot.ts',
  'apps/web/tests/code-mode-round.e2e.ts',
  'apps/web/tests/cordis-tool-round.e2e.ts',
  'apps/web/tests/feedback-command.e2e.ts',
  'apps/web/tests/goal-bar.e2e.ts',
  'apps/web/tests/goal-command-presentation.e2e.ts',
  'apps/web/tests/goal-multi-turn-actions.e2e.ts',
  'apps/web/tests/message-feedback-layout.e2e.ts',
  'apps/web/tests/message-feedback-protocol.snapshot.ts',
  'apps/web/tests/message-feedback.e2e.ts',
  'apps/web/tests/permission-policy-context.e2e.ts',
  'apps/web/tests/produced-file-mentions.e2e.ts',
  'apps/web/tests/produced-files.e2e.ts',
  'apps/web/tests/pwsh-terminal.e2e.ts',
  'apps/web/tests/shipped-composition.e2e.ts',
  'apps/web/tests/smoke-real.e2e.ts',
  'apps/web/tests/sidebar-subagent-activity.e2e.ts',
  'apps/web/tests/subagent-conversation.e2e.ts',
  'apps/web/tests/subagent-interrupt-ui.e2e.ts',
  'apps/web/tests/subagent-interrupt.e2e.ts',
  'apps/web/tests/todo-row.snapshot.ts',
  'apps/web/tests/trajectory-virtualization.e2e.ts',
  'apps/web/tests/web-search-round.e2e.ts',
  'apps/web/tests/workflow-run.e2e.ts',
])
