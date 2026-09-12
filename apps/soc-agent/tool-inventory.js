// Runtime-independent tool inventory. Draft preparation never delivers mail.

export const OFFICIAL_SPLUNK_TOOL_NAMES = Object.freeze([
  'splunk_run_query',
  'splunk_get_info',
  'splunk_get_indexes',
  'splunk_get_index_info',
  'splunk_get_metadata',
  'splunk_get_knowledge_objects',
  'splunk_run_saved_search',
  'splunk_list_alerts',
  'splunk_get_alert_details',
  'splunk_list_fired_alerts',
  'splunk_get_fired_alert_details',
  'splunk_get_alert_throttle',
  'splunk_list_active_throttles',
])

export const TOOL_CATALOG = Object.freeze([
  { name: 'mcp__soc_agent__zimbra_list_folders', group: 'Zimbra', label: 'List mail folders', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_search_emails', group: 'Zimbra', label: 'Search email', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_get_email', group: 'Zimbra', label: 'Read email', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_get_email_headers', group: 'Zimbra', label: 'Read email headers', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_get_attachment_text', group: 'Zimbra', label: 'Read attachment text', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_send_email', group: 'Zimbra', label: 'Create email draft', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_list_signatures', group: 'Zimbra', label: 'List signatures', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_use_signature_on_email', group: 'Zimbra', label: 'Create signed email draft', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_list_email_filters', group: 'Zimbra', label: 'List email filters', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_get_email_filter', group: 'Zimbra', label: 'Read email filter', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_validate_email_filter', group: 'Zimbra', label: 'Validate email filter', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_preview_email_filter_update', group: 'Zimbra', label: 'Preview email filter update', kind: 'read' },
  { name: 'mcp__soc_agent__zimbra_move_email', group: 'Zimbra', label: 'Move email', kind: 'mutation' },
  { name: 'mcp__soc_agent__zimbra_create_email_filter', group: 'Zimbra', label: 'Create email filter', kind: 'mutation' },
  { name: 'mcp__soc_agent__zimbra_update_email_filter', group: 'Zimbra', label: 'Update email filter', kind: 'mutation' },
  { name: 'mcp__soc_agent__zimbra_delete_email_filter', group: 'Zimbra', label: 'Delete email filter', kind: 'mutation' },
  { name: 'mcp__soc_agent__zimbra_set_email_filter_enabled', group: 'Zimbra', label: 'Enable or disable email filter', kind: 'mutation' },
  { name: 'mcp__soc_agent__zimbra_reorder_email_filter', group: 'Zimbra', label: 'Reorder email filters', kind: 'mutation' },
  { name: 'mcp__soc_agent__zimbra_create_folder', group: 'Zimbra', label: 'Create folder', kind: 'mutation' },
  { name: 'mcp__soc_agent__zimbra_create_signature', group: 'Zimbra', label: 'Create signature', kind: 'mutation' },
  { name: 'mcp__soc_agent__zimbra_delete_signature', group: 'Zimbra', label: 'Delete signature', kind: 'mutation' },
  { name: 'mcp__soc_agent__create_subscription', group: 'Subscriptions', label: 'Create subscription', kind: 'mutation' },
  { name: 'mcp__soc_agent__update_subscription', group: 'Subscriptions', label: 'Update subscription', kind: 'mutation' },
  { name: 'mcp__soc_agent__delete_subscription', group: 'Subscriptions', label: 'Delete subscription', kind: 'mutation' },
  { name: 'ui__soc_agent__send_email', group: 'Zimbra', label: 'Send email (UI-confirmed)', kind: 'ui-confirmed' },
].map(Object.freeze))

export const SUBSCRIPTION_READ_TOOLS = Object.freeze([
  'mcp__soc_agent__list_subscriptions',
  'mcp__soc_agent__get_subscription_schema',
  'mcp__soc_agent__preview_subscription',
])
