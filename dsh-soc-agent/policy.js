// Shared SOC tool policy categories.

export const READ_ONLY_TOOLS = Object.freeze([
  'skill',
  'mcp__soc_agent__system_get_status',
  'mcp__soc_agent__splunk_validate_query',
  'mcp__soc_agent__splunk_search',
  'mcp__soc_agent__splunk_list_saved_searches',
  'mcp__soc_agent__splunk_run_saved_search',
  'mcp__soc_agent__splunk_find_lookup',
  'mcp__soc_agent__splunk_list_lookups',
  'mcp__soc_agent__splunk_get_detection',
  'mcp__soc_agent__splunk_validate_detection',
  'mcp__soc_agent__splunk_backtest_detection',
  'mcp__soc_agent__zimbra_list_accounts',
  'mcp__soc_agent__zimbra_list_folders',
  'mcp__soc_agent__zimbra_search_emails',
  'mcp__soc_agent__zimbra_get_email',
  'mcp__soc_agent__zimbra_get_attachment_text',
  'mcp__soc_agent__zimbra_create_email_draft',
  'mcp__soc_agent__zimbra_list_email_filters',
  'mcp__soc_agent__zimbra_get_email_filter',
  'mcp__soc_agent__zimbra_validate_email_filter',
  'mcp__soc_agent__zimbra_preview_email_filter_update',
  'mcp__soc_agent__email_list_subscriptions',
  'mcp__soc_agent__email_get_subscription_schema',
  'mcp__soc_agent__email_preview_subscription',
  'scheduled_task_list',
])

export const ACTION_TOOLS = Object.freeze([
  'mcp__soc_agent__splunk_create_detection_draft',
  'mcp__soc_agent__splunk_update_detection_draft',
  'mcp__soc_agent__splunk_enable_detection',
  'mcp__soc_agent__splunk_disable_detection',
  'mcp__soc_agent__zimbra_send_email',
  'mcp__soc_agent__zimbra_create_email_filter',
  'mcp__soc_agent__zimbra_update_email_filter',
  'mcp__soc_agent__zimbra_set_email_filter_enabled',
  'mcp__soc_agent__zimbra_reorder_email_filter',
  'mcp__soc_agent__email_create_subscription',
  'mcp__soc_agent__email_update_subscription',
  'mcp__soc_agent__email_delete_subscription',
  'mcp__soc_agent__zimbra_create_folder',
  'scheduled_task_create',
  'scheduled_task_pause',
  'scheduled_task_resume',
  'scheduled_task_delete',
  'scheduled_task_run_now',
])

export const DOMAIN_TOOLS = new Set([...READ_ONLY_TOOLS, ...ACTION_TOOLS])
export const APPROVAL_TOOLS = new Set(ACTION_TOOLS)

// Scheduled investigations cannot access subscription administration data or
// scheduler inspection/mutation tools.
const SCHEDULED_EXCLUDED_READ_TOOLS = new Set([
  'scheduled_task_list',
  'mcp__soc_agent__zimbra_create_email_draft',
  'mcp__soc_agent__email_list_subscriptions',
  'mcp__soc_agent__email_get_subscription_schema',
  'mcp__soc_agent__email_preview_subscription',
])

export const READ_ONLY_DOMAIN_TOOLS = Object.freeze(
  READ_ONLY_TOOLS.filter(name => !SCHEDULED_EXCLUDED_READ_TOOLS.has(name)),
)
