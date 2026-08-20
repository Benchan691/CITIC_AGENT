// Shared SOC tool policy categories.

export const READ_ONLY_TOOLS = Object.freeze([
  'skill',
  'mcp__soc_agent__system_get_status',
  'mcp__soc_agent__splunk_validate_query',
  'mcp__soc_agent__splunk_search',
  'mcp__soc_agent__splunk_list_indexes',
  'mcp__soc_agent__splunk_list_saved_searches',
  'mcp__soc_agent__splunk_run_saved_search',
  'mcp__soc_agent__splunk_list_data_sources',
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
  'scheduled_task_list',
])

export const ACTION_TOOLS = Object.freeze([
  'mcp__soc_agent__splunk_create_detection_draft',
  'mcp__soc_agent__splunk_update_detection_draft',
  'mcp__soc_agent__splunk_enable_detection',
  'mcp__soc_agent__splunk_disable_detection',
  'mcp__soc_agent__zimbra_send_email',
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
