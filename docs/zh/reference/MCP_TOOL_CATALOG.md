# MCP 工具目录（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../../reference/MCP_TOOL_CATALOG.md)。
> 生成自权威注册证据: `apps/soc-agent/tool-inventory.js`（单一清单）、`cordis.patch.yml`（原始允许列表）、`policy.js`（派生策略集）、`splunk-bridge.js`（桥接）、`server.py` + 工具模块（注册）。交叉校验: `policy.test.js`、`skills.test.js`、`splunk-bridge.test.js`、`test_server_tools.py`。

**本页读者:** 改动工具面的开发者、追踪模型可调用的安全评审者、排查"撞名"工具的人。

**命名解剖:** 全限定名 `mcp__<服务器>__<原始工具>`；非 MCP 形态 `ui__soc_agent__send_email`（UI 确认目录条目）与 `skill`（无前缀宿主工具）。

**单一事实源（本轮新增）:** `apps/soc-agent/tool-inventory.js` 导出 `OFFICIAL_SPLUNK_TOOL_NAMES`、`TOOL_CATALOG`、`SUBSCRIPTION_READ_TOOLS`；`policy.js` 从它派生策略集，`splunk-bridge.js` 导入原始名。

本提交计数: **28** 个 `soc_agent` 注册工具（Python `test_server_tools.py` 断言 `len(tools) == 28`；JS `skills.test.js` 钉住同一名单）、**13** 个 `splunk_mcp` 只读工具、**1** 个 `skill` 宿主工具、另有 2 个 harness 控制工具（`ask_user_question`、`exit_plan_mode`）。派生策略集: **30** 只读、**42** 域、**12** 审批（`policy.test.js` 逐字钉扎）。

---

## 1. `soc_agent` — Zimbra 邮件工具（13）

全部身份源: 认证应用会话（`soc_session_id` 元数据 → `identity_for_session` → 用户本人 Zimbra 令牌；`account_id` 选择被 `account_selection_disabled` 拒绝）。外部依赖: Zimbra SOAP（`ZIMBRA_HOST`）。

| 原始名 | 全限定名 | 用途 | 分类 | 默认状态 | 附加门/确认 | 测试 |
|---|---|---|---|---|---|---|
| `zimbra_list_folders` | `mcp__soc_agent__zimbra_list_folders` | 列文件夹+计数 | 读 | auto | — | `test_zimbra_service.py` |
| `zimbra_search_emails` | `…zimbra_search_emails` | 一页邮件元数据 | 读 | auto | 联网前校验查询 | 同上 |
| `zimbra_get_email` | `…zimbra_get_email` | 单封邮件；正文默认 20 k、钳制 ≤100 k 字符 | 读 | auto | — | 同上 |
| `zimbra_get_email_headers` | `…zimbra_get_email_headers` | 仅选定认证/路由头（允许列表 12 个；每次 1–12 个） | 读 | auto | — | 同上 |
| `zimbra_get_attachment_text` | `…zimbra_get_attachment_text` | 有界附件 → Markdown | 读 | auto | 尺寸/字符限额；`attachment_*` 错误码 | 同上 |
| `zimbra_send_email` | `…zimbra_send_email` | **仅创建本地草稿 — 从不发送、从不持久化。** UI 标签 "Create email draft" | 读类 | auto | 收件人校验；草稿随工具结果返回 | 同上 |
| `zimbra_forward_email` | `…zimbra_forward_email` | **新增：** 从一封邮件准备可编辑**转发草稿**（"Forward email (draft)"）；读取原信并内嵌 `forward_message_id` + `forwarded_message` 元数据（主题/发件人/日期/正文/附件）。**从不发送或写入 Zimbra** | 读类（`readOnlyHint: true`） | auto | 参数 `{message_id, to, cc, bcc, subject, body}`；必填 `{message_id, to}` | `test_server_tools.py`（转发 schema）、`test_zimbra_service.py` |
| `zimbra_use_signature_on_email` | `…zimbra_use_signature_on_email` | 合并签名的可编辑草稿；docstring "it never sends" | 读类 | auto | — | 同上 |
| `zimbra_list_signatures` | `…zimbra_list_signatures` | 列签名（text+HTML） | 读 | auto | — | — |
| `zimbra_create_folder` | `…zimbra_create_folder` | 建一级子文件夹 | 变更 | ask | `ZIMBRA_ALLOW_FOLDER_WRITE` | `ACTION_CATALOG` |
| `zimbra_move_email` | `…zimbra_move_email` | 移动邮件到已校验文件夹 | 变更 | ask | `ZIMBRA_ALLOW_MOVE`；校验+回滚载荷 | `test_zimbra_service.py` |
| `zimbra_create_signature` | `…zimbra_create_signature` | 建签名 | 变更 | ask | `ZIMBRA_ALLOW_SIGNATURE_WRITE` | 同上 |
| `zimbra_delete_signature` | `…zimbra_delete_signature` | 删签名 | 变更 | ask | `ZIMBRA_ALLOW_SIGNATURE_WRITE` | 同上 |

## 2. `soc_agent` — Zimbra 过滤器工具（9）

所有写入整组替换规则集并要求 `expected_fingerprint`（活动规则的 SHA-256）— 不匹配 → `filter_rules_changed`。写门: `ZIMBRA_ALLOW_FILTER_WRITE`；redirect/discard 另受 `ZIMBRA_ALLOW_FILTER_REDIRECT` / `ZIMBRA_ALLOW_FILTER_DISCARD` 门控。

| 原始名 | 用途 | 分类 | 默认状态 |
|---|---|---|---|
| `zimbra_list_email_filters` | 列规则（+指纹） | 读 | auto |
| `zimbra_get_email_filter` | 单条规则 | 读 | auto |
| `zimbra_validate_email_filter` | 不写入的校验 | 读 | auto |
| `zimbra_preview_email_filter_update` | 合并拟议规则 + 变更字段，不写 | 读 | auto |
| `zimbra_create_email_filter` | 建规则 | 变更 | ask |
| `zimbra_update_email_filter` | 改规则 | 变更 | ask |
| `zimbra_delete_email_filter` | 删规则 | 变更 | ask |
| `zimbra_set_email_filter_enabled` | 启/停规则 | 变更 | ask |
| `zimbra_reorder_email_filter` | 重排（1 基位置） | 变更 | ask |

测试: `test_zimbra_filters.py`（4）。

## 3. `soc_agent` — 订阅工具（6）

外部依赖: 订阅 web 服务（`SUBSCRIPTION_SERVER_URL`、表单登录、重定向校验）。身份源: 环境中的服务凭据（非按用户）。

| 原始名 | 用途 | 分类 | 默认状态 |
|---|---|---|---|
| `list_subscriptions` | `GET /api/subscriptions` | 读 | auto |
| `get_subscription_schema` | 实时 schema/字段/限额 | 读 | auto |
| `preview_subscription` | 创建/更新干跑校验 | 读 | auto |
| `create_subscription` | `POST /api/subscriptions` | 变更 | ask |
| `update_subscription` | `PUT /api/subscriptions/{email}` | 变更 | ask |
| `delete_subscription` | `DELETE /api/subscriptions/{email}` | 变更 | ask |

测试: `test_email_service.py`（3）。

## 4. `splunk_mcp` — 官方 Splunk 只读工具（13，桥接允许列表）

服务器 `splunk_mcp`，仅在 `SPLUNK_MCP_ENDPOINT` + `SPLUNK_TOKEN` 配置时由 `splunk-bridge.js` 注册（`failOnStartupError: true`、185 秒超时、默认 TLS 校验；端点 URL 校验 — 无内嵌凭据/查询/片段，明文 HTTP 需 `SPLUNK_ALLOW_INSECURE_HTTP=true`）。身份源: 桥接的服务令牌（Bearer）— 非按用户。全部属于 `OFFICIAL_SPLUNK_READ_TOOLS` ⊂ `READ_ONLY_TOOLS`，默认 auto。外部 Splunk MCP 服务器自有防护；本地结果仍经调查投影（卡号/SSN 掩码、50 KB 截断）。原始名来自 `tool-inventory.js` — 与 policy.js 同一模块。

13 个原始名: `splunk_run_query`、`splunk_get_info`（也是管理连接检查探针）、`splunk_get_indexes`、`splunk_get_index_info`、`splunk_get_metadata`、`splunk_get_knowledge_objects`、`splunk_run_saved_search`、`splunk_list_alerts`、`splunk_get_alert_details`、`splunk_list_fired_alerts`、`splunk_get_fired_alert_details`、`splunk_get_alert_throttle`、`splunk_list_active_throttles`（全限定名 = `mcp__splunk_mcp__` + 原始名）。

清单中不存在任何 `splunk_(create|update|delete|write)_*` 名（`splunk-bridge.test.js` / `skills.test.js` 断言）。

## 5. 宿主提供与非 MCP 名

| 名字 | 是什么 | 分类/策略 |
|---|---|---|
| `skill` | harness `tool-skill` 插件工具：加载技能指令 | 读（`READ_ONLY_TOOLS`），默认 auto；无 `mcp__` 前缀 |
| `ask_user_question`、`exit_plan_mode` | harness 交互工具 | 经 `host.js` `CONTROL_TOOLS` 连同 `DOMAIN_TOOLS` 允许 |
| `ui__soc_agent__send_email` | 目录条目（`kind: 'ui-confirmed'`），管理清单中带 "Explicit confirmation" 徽章 | 不是工具；不可自动化。投递路径: 草稿视图 → `window.confirm` → `send-email` RPC → 控制通道 → `ZimbraMailService.send_email`（门 `ZIMBRA_ALLOW_SEND`；现接受 `forward_message_id` 转发投递） |

## 6. 转发流程（本轮新增）

1. 模型调用 `zimbra_forward_email {message_id, to, …}` → `ZimbraMailService.create_forward_draft` 读取原信，构建**本地**草稿（主题 `Fwd: …`），附加 `forward_message_id` 与 `forwarded_message` 元数据。不发送、不保存。
2. 草稿卡（键于转发工具名）显示原信元数据；用户编辑并确认 Send。
3. `send-email` RPC 携带 `forward_message_id`；`auth_cli send-email` 传给 `ZimbraMailService.send_email`，经 `zimbra_forward_message`（SOAP）**连同原信与附件**投递，仍受 `ZIMBRA_ALLOW_SEND` 门控。

转发 = 一个只读草稿步骤 + 与任何邮件相同的人确认发送路径 — 模型依然没有发信工具。

## 7. 已移除的实现（原"保留"）

Python Splunk 栈本轮**整体删除**: `splunk/**`（search、detection、security queue、core）、`splunk_service.py`、`detection.py` 及其测试。检测/SPL 技能（`detection-engineering`、`spl-writing`、`false-positive-analysis` 部分）因此引用的工具在仓库中已不存在 — 见 [DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md) §6/§8。`test_server_tools.py` 继续断言 `soc_agent` 上**无** `splunk_*` 工具。
