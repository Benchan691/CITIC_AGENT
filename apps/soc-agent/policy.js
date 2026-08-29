// Shared SOC tool policy categories.

export const READ_ONLY_TOOLS = Object.freeze([
  'skill',
  'mcp__soc_agent__system_get_status',
  'mcp__soc_agent__splunk_validate_query',
  'mcp__soc_agent__splunk_search',
  'mcp__soc_agent__splunk_search_intent',
  'mcp__soc_agent__splunk_list_security_findings',
  'mcp__soc_agent__splunk_get_security_finding',
  'mcp__soc_agent__splunk_list_saved_searches',
  'mcp__soc_agent__splunk_run_saved_search',
  'mcp__soc_agent__splunk_find_lookup',
  'mcp__soc_agent__splunk_list_lookups',
  'mcp__soc_agent__splunk_get_detection',
  'mcp__soc_agent__splunk_validate_detection',
  'mcp__soc_agent__splunk_backtest_detection',
  'mcp__soc_agent__zimbra_list_folders',
  'mcp__soc_agent__zimbra_search_emails',
  'mcp__soc_agent__zimbra_get_email',
  'mcp__soc_agent__zimbra_get_email_headers',
  'mcp__soc_agent__zimbra_get_attachment_text',
  'mcp__soc_agent__zimbra_send_email',
  'mcp__soc_agent__zimbra_list_signatures',
  'mcp__soc_agent__zimbra_use_signature_on_email',
  'mcp__soc_agent__zimbra_list_email_filters',
  'mcp__soc_agent__zimbra_get_email_filter',
  'mcp__soc_agent__zimbra_validate_email_filter',
  'mcp__soc_agent__zimbra_preview_email_filter_update',
  'mcp__soc_agent__list_subscriptions',
  'mcp__soc_agent__get_subscription_schema',
  'mcp__soc_agent__preview_subscription',
  'scheduled_task_list',
  'soc_memory_search',
  'soc_memory_read',
])

/**
 * The one user-facing catalog of actions. Keep the tool name here in sync
 * with the MCP server and derive ACTION_TOOLS below so policy and UI cannot
 * silently drift apart.
 */
export const ACTION_CATALOG = Object.freeze([
  { name: 'mcp__soc_agent__zimbra_move_email', group: 'Zimbra', label: 'Move email' },
  { name: 'mcp__soc_agent__zimbra_create_email_filter', group: 'Zimbra', label: 'Create email filter' },
  { name: 'mcp__soc_agent__zimbra_update_email_filter', group: 'Zimbra', label: 'Update email filter' },
  { name: 'mcp__soc_agent__zimbra_delete_email_filter', group: 'Zimbra', label: 'Delete email filter' },
  { name: 'mcp__soc_agent__zimbra_set_email_filter_enabled', group: 'Zimbra', label: 'Enable or disable email filter' },
  { name: 'mcp__soc_agent__zimbra_reorder_email_filter', group: 'Zimbra', label: 'Reorder email filters' },
  { name: 'mcp__soc_agent__zimbra_create_folder', group: 'Zimbra', label: 'Create folder' },
  { name: 'mcp__soc_agent__zimbra_create_signature', group: 'Zimbra', label: 'Create signature' },
  { name: 'mcp__soc_agent__zimbra_delete_signature', group: 'Zimbra', label: 'Delete signature' },
  { name: 'mcp__soc_agent__splunk_create_detection_draft', group: 'Splunk', label: 'Create detection draft' },
  { name: 'mcp__soc_agent__splunk_update_detection_draft', group: 'Splunk', label: 'Update detection draft' },
  { name: 'mcp__soc_agent__splunk_enable_detection', group: 'Splunk', label: 'Enable detection' },
  { name: 'mcp__soc_agent__splunk_disable_detection', group: 'Splunk', label: 'Disable detection' },
  { name: 'mcp__soc_agent__splunk_approve_detection_change', group: 'Splunk', label: 'Approve exact detection change' },
  { name: 'mcp__soc_agent__splunk_apply_approved_detection_change', group: 'Splunk', label: 'Apply approved detection change' },
  { name: 'mcp__soc_agent__create_subscription', group: 'Subscriptions', label: 'Create subscription' },
  { name: 'mcp__soc_agent__update_subscription', group: 'Subscriptions', label: 'Update subscription' },
  { name: 'mcp__soc_agent__delete_subscription', group: 'Subscriptions', label: 'Delete subscription' },
  { name: 'scheduled_task_create', group: 'Schedules', label: 'Create scheduled task' },
  { name: 'scheduled_task_pause', group: 'Schedules', label: 'Pause scheduled task' },
  { name: 'scheduled_task_resume', group: 'Schedules', label: 'Resume scheduled task' },
  { name: 'scheduled_task_delete', group: 'Schedules', label: 'Delete scheduled task' },
  { name: 'scheduled_task_run_now', group: 'Schedules', label: 'Run scheduled task now' },
  { name: 'soc_memory_add', group: 'SOC memory', label: 'Add memory' },
  { name: 'soc_memory_correct', group: 'SOC memory', label: 'Correct memory' },
  { name: 'soc_memory_forget', group: 'SOC memory', label: 'Forget memory' },
])

export const ACTION_TOOLS = Object.freeze(ACTION_CATALOG.map(action => action.name))

// Detection writes are proposal-bound in the backend. These names must never
// be satisfied by the generic remembered action-name policy.
export const DETECTION_ACTION_TOOLS = Object.freeze([
  'mcp__soc_agent__splunk_create_detection_draft',
  'mcp__soc_agent__splunk_update_detection_draft',
  'mcp__soc_agent__splunk_enable_detection',
  'mcp__soc_agent__splunk_disable_detection',
  'mcp__soc_agent__splunk_approve_detection_change',
  'mcp__soc_agent__splunk_apply_approved_detection_change',
])

export const MEMORY_READ_TOOLS = Object.freeze([
  'soc_memory_search',
  'soc_memory_read',
])

export const MEMORY_WRITE_TOOLS = Object.freeze([
  'soc_memory_add',
  'soc_memory_correct',
  'soc_memory_forget',
])

export const DOMAIN_TOOLS = new Set([...READ_ONLY_TOOLS, ...ACTION_TOOLS])
export const APPROVAL_TOOLS = new Set(ACTION_TOOLS)

// Scheduled investigations cannot access scheduler inspection/mutation tools
// or create browser-editable email drafts.
const SCHEDULED_EXCLUDED_READ_TOOLS = new Set([
  'scheduled_task_list',
  'mcp__soc_agent__zimbra_send_email',
  'mcp__soc_agent__zimbra_use_signature_on_email',
  'mcp__soc_agent__list_subscriptions',
  'mcp__soc_agent__get_subscription_schema',
  'mcp__soc_agent__preview_subscription',
])
export const READ_ONLY_DOMAIN_TOOLS = Object.freeze(
  READ_ONLY_TOOLS.filter(name => !SCHEDULED_EXCLUDED_READ_TOOLS.has(name)),
)
