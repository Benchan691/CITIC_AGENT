// Derive policy categories and admin choices from the same tool inventory.
import { OFFICIAL_SPLUNK_TOOL_NAMES, SUBSCRIPTION_READ_TOOLS, TOOL_CATALOG } from './tool-inventory.js'

export { TOOL_CATALOG }
export const OFFICIAL_SPLUNK_READ_TOOLS = Object.freeze(
  OFFICIAL_SPLUNK_TOOL_NAMES.map(name => `mcp__splunk_mcp__${name}`),
)
export const ZIMBRA_READ_TOOLS = Object.freeze(
  TOOL_CATALOG.filter(tool => tool.kind === 'read').map(tool => tool.name),
)
export const READ_ONLY_TOOLS = Object.freeze([
  'skill', ...OFFICIAL_SPLUNK_READ_TOOLS, ...ZIMBRA_READ_TOOLS, ...SUBSCRIPTION_READ_TOOLS,
])
export const ACTION_CATALOG = Object.freeze(
  TOOL_CATALOG.filter(tool => tool.kind === 'mutation').map(({ kind, ...action }) => Object.freeze(action)),
)
export const ACTION_TOOLS = Object.freeze(ACTION_CATALOG.map(action => action.name))
export const MANAGED_TOOL_NAMES = Object.freeze(
  TOOL_CATALOG.filter(tool => tool.kind !== 'ui-confirmed').map(tool => tool.name),
)
export const ALWAYS_ASK_ACTION_TOOLS = Object.freeze([])
export const DOMAIN_TOOLS = new Set([...READ_ONLY_TOOLS, ...ACTION_TOOLS])
export const APPROVAL_TOOLS = new Set(ACTION_TOOLS)
