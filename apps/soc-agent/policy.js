// Shared SOC tool policy categories.

export const OFFICIAL_SPLUNK_READ_TOOLS = Object.freeze([
  'mcp__splunk_official__splunk_run_query',
  'mcp__splunk_official__splunk_get_info',
  'mcp__splunk_official__splunk_get_indexes',
  'mcp__splunk_official__splunk_get_index_info',
  'mcp__splunk_official__splunk_get_metadata',
  'mcp__splunk_official__splunk_get_knowledge_objects',
  'mcp__splunk_official__splunk_run_saved_search',
  'mcp__splunk_official__splunk_list_alerts',
  'mcp__splunk_official__splunk_get_alert_details',
  'mcp__splunk_official__splunk_list_fired_alerts',
  'mcp__splunk_official__splunk_get_fired_alert_details',
  'mcp__splunk_official__splunk_get_alert_throttle',
  'mcp__splunk_official__splunk_list_active_throttles',
])

export const READ_ONLY_TOOLS = Object.freeze([
  'skill',
  ...OFFICIAL_SPLUNK_READ_TOOLS,
  'mcp__soc_agent__system_get_status',
  'mcp__soc_agent__splunk_validate_query',
  'mcp__soc_agent__splunk_search',
  'mcp__soc_agent__splunk_list_security_findings',
  'mcp__soc_agent__splunk_get_security_finding',
  'mcp__soc_agent__splunk_list_saved_searches',
  'mcp__soc_agent__splunk_run_saved_search',
  'mcp__soc_agent__splunk_find_lookup',
  'mcp__soc_agent__splunk_list_lookups',
  'mcp__soc_agent__splunk_get_lookup',
  'mcp__soc_agent__splunk_get_detection',
  'mcp__soc_agent__splunk_validate_detection',
  'mcp__soc_agent__splunk_compile_citic_detection',
  'mcp__soc_agent__splunk_backtest_detection',
  'mcp__soc_agent__soc_evidence_read',
  'mcp__soc_agent__splunk_plan_search',
  'mcp__soc_agent__catalog_list_rules',
  'mcp__soc_agent__catalog_get_rule',
  'mcp__soc_agent__catalog_list_customers',
  'mcp__soc_agent__catalog_get_customer',
  'mcp__soc_agent__catalog_list_fix_source_types',
  'mcp__soc_agent__catalog_get_fix_source_type',
  'mcp__soc_agent__catalog_get_record_history',
  'mcp__soc_agent__catalog_preview_publication',
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
  { name: 'mcp__soc_agent__catalog_write_rule', group: 'Catalogs', label: 'Create Ruleset draft' },
  { name: 'mcp__soc_agent__catalog_update_rule', group: 'Catalogs', label: 'Edit Ruleset record' },
  { name: 'mcp__soc_agent__catalog_write_customer', group: 'Catalogs', label: 'Create customer draft' },
  { name: 'mcp__soc_agent__catalog_update_customer', group: 'Catalogs', label: 'Edit customer record' },
  { name: 'mcp__soc_agent__catalog_write_fix_source_type', group: 'Catalogs', label: 'Create Fix Source type draft' },
  { name: 'mcp__soc_agent__catalog_update_fix_source_type', group: 'Catalogs', label: 'Edit Fix Source type record' },
  { name: 'mcp__soc_agent__catalog_archive_record', group: 'Catalogs', label: 'Archive or restore catalog record' },
  { name: 'mcp__soc_agent__create_subscription', group: 'Subscriptions', label: 'Create subscription' },
  { name: 'mcp__soc_agent__update_subscription', group: 'Subscriptions', label: 'Update subscription' },
  { name: 'mcp__soc_agent__delete_subscription', group: 'Subscriptions', label: 'Delete subscription' },
  { name: 'scheduled_task_create', group: 'Schedules', label: 'Create scheduled task' },
  { name: 'scheduled_task_pause', group: 'Schedules', label: 'Pause scheduled task' },
  { name: 'scheduled_task_resume', group: 'Schedules', label: 'Resume scheduled task' },
  { name: 'scheduled_task_delete', group: 'Schedules', label: 'Delete scheduled task' },
  { name: 'scheduled_task_run_now', group: 'Schedules', label: 'Run scheduled task now' },
])

export const ACTION_TOOLS = Object.freeze(ACTION_CATALOG.map(action => action.name))

export const CATALOG_ACTION_TOOLS = Object.freeze([
  'mcp__soc_agent__catalog_write_rule',
  'mcp__soc_agent__catalog_update_rule',
  'mcp__soc_agent__catalog_write_customer',
  'mcp__soc_agent__catalog_update_customer',
  'mcp__soc_agent__catalog_write_fix_source_type',
  'mcp__soc_agent__catalog_update_fix_source_type',
  'mcp__soc_agent__catalog_archive_record',
])

// Draft changes must never be auto-approved by a remembered session policy.
export const ALWAYS_ASK_ACTION_TOOLS = Object.freeze([
  ...CATALOG_ACTION_TOOLS,
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
