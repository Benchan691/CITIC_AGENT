// Shared SOC tool policy categories.

export const READ_ONLY_TOOLS = Object.freeze([
  'mcp__splunk_zimbra__system_get_status',
  'mcp__splunk_zimbra__splunk_validate_query',
  'mcp__splunk_zimbra__splunk_search',
  'mcp__splunk_zimbra__splunk_list_indexes',
  'mcp__splunk_zimbra__splunk_list_saved_searches',
  'mcp__splunk_zimbra__splunk_run_saved_search',
  'mcp__splunk_zimbra__splunk_list_data_sources',
  'mcp__splunk_zimbra__splunk_get_detection',
  'mcp__splunk_zimbra__splunk_validate_detection',
  'mcp__splunk_zimbra__splunk_backtest_detection',
  'mcp__splunk_zimbra__zimbra_list_accounts',
  'mcp__splunk_zimbra__zimbra_list_folders',
  'mcp__splunk_zimbra__zimbra_search_emails',
  'mcp__splunk_zimbra__zimbra_get_email',
  'mcp__splunk_zimbra__zimbra_get_attachment_text',
  'scheduled_task_list',
])

export const ACTION_TOOLS = Object.freeze([
  'mcp__splunk_zimbra__splunk_create_detection_draft',
  'mcp__splunk_zimbra__splunk_update_detection_draft',
  'mcp__splunk_zimbra__splunk_enable_detection',
  'mcp__splunk_zimbra__splunk_disable_detection',
  'mcp__splunk_zimbra__zimbra_send_email',
  'scheduled_task_create',
  'scheduled_task_pause',
  'scheduled_task_resume',
  'scheduled_task_delete',
  'scheduled_task_run_now',
])

export const DOMAIN_TOOLS = new Set([...READ_ONLY_TOOLS, ...ACTION_TOOLS])
export const APPROVAL_TOOLS = new Set(ACTION_TOOLS)

// Scheduled investigations intentionally receive only the original domain
// read set, never scheduler mutation or inspection tools.
export const READ_ONLY_DOMAIN_TOOLS = Object.freeze(READ_ONLY_TOOLS.filter(name => name !== 'scheduled_task_list'))
