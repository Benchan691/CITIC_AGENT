# 接口目录（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../../reference/INTERFACE_CATALOG.md)

**本页读者:** 改动边界的开发者、枚举入口的安全评审者。

**读完后你将了解:** 每个有意义的第一方边界 — 调用者、被调用者、认证、输入/输出、错误、限额、测试。形状均为脱敏示例。

相关: [MCP_TOOL_CATALOG.md](MCP_TOOL_CATALOG.md)（逐工具）、[CONFIGURATION_REFERENCE.md](CONFIGURATION_REFERENCE.md)（环境契约）、[TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md)。

---

## 1. 进程入口点

| 入口 | 调用方式 | 用途 |
|---|---|---|
| harness web 运行时 | `cd vendor/deepseek-harness && pnpm dsh web --no-open`（端口 3080） | 启动 Node 宿主 + web 服务器；加载 web profile 插件（SOC bundle） |
| `unified-mcp-server` | `uv run unified-mcp-server`（`dsh-mcp-client` 按 `cordis.patch.yml` 拉起；cwd `apps/soc-agent/server`） | `soc_agent` stdio MCP 服务器（`server.py main()`） |
| `unified_mcp_server.control_server` | `ownership.js startControlChannel` 拉起 | 常驻认证操作通道 |
| `unified_mcp_server.auth_cli <命令>` | 通道关闭/不可用时按命令拉起（共享 `python-command.js` 运行器） | 一次性认证操作（`login`、`logout`、`send-email` — 现转发 `forward_message_id`、`list-signatures`） |
| `unified_mcp_server.admin_cli <命令>` | `host.js runAdmin` → `python-command.js` 拉起 | 一次性管理操作: `get-settings`、`test-subscription-server`、`convert-attachment`、`migrate`。`test-splunk` 已移除 |
| `unified_mcp_server.schema migrate` | `ownership.js ensureSchema` 与管理 `migrate` RPC 拉起；**PostgreSQL URI 以 JSON 经 stdin 传入** | 在 `pg_advisory_xact_lock` 下应用待处理 `migrations/*.sql`；输出 `{"migrated": true}` 或 `schema_migration_failed` |
| `setup.sh [--check|--plugins]` / `update.sh` | 运维 | 安装/审计/修复/更新（Splunk 参数仅 MCP：端点+令牌必填） |

## 2. HTTP 面（Node 宿主）

| 路由 | 方法 | 认证 | 用途 | 证据 |
|---|---|---|---|---|
| `/auth/login` | POST | 公开（+ 同站/Origin 检查、32 KiB JSON 上限） | Zimbra 凭据登录 → `soc_session`；单设备替换；General 工作区引导 | `ownership.js handleAuthRoute('login')` |
| `/auth/logout` | POST | Cookie | 删除会话 + 解绑代理 + 清 Cookie | `handleAuthRoute('logout')` |
| `/auth/me` | GET | 会话 | 会话探测（`expires_at`；一次性 `new_device_login` 原因） | `handleAuthRoute('me')` |
| `/admin/auth/login` | POST | 公开（同站） | 静态管理员登录 → `soc_admin_session`（8 h） | `handleAdminAuthRoute` |
| `/admin/auth/logout` / `/admin/auth/me` | POST / GET | 管理 Cookie | 丢弃/探测管理员会话 | 同上 |
| `/admin` | GET/HEAD | （页面本身；RPC 强制管理员） | 管理控制台 HTML | `host.js serveAdminPage` |
| `/api/**`、`/soc-agent-*` | 混合 | `installTransport` 圈栏 | harness + 受限产品 API；特权方法需管理员 | `ownership.js installTransport` |
| `/api/events.mux`、`/api/events.host` | WebSocket | 会话；帧按用户过滤/脱敏 | 实时事件流 | `PRIVATE_UPGRADE_PATHS`、`filteredFrames` |

## 3. RPC 通道 `/soc-agent-config`（浏览器 ⇄ 宿主）

以 `authority: 'trusted-host'` 注册；每端点再查认证。错误: `authentication-required`、`admin-authentication-required`（已钉入上游 `apiproxy` schema）、`bad-request`、`attachment-error{reason}`、`internalError`。

| 端点 | 认证 | 输入 → 输出 | 证据 |
|---|---|---|---|
| `get-action-catalog` / `get-admin-action-catalog` | 用户 / 管理员 | `{}` → `{actions, tools}` | `host.js handleEndpoint` |
| `get-action-policy` | 用户 | `{}` → `{actions, tools, mode, actionStates, source}` | `policyValue` |
| `set-action-mode` | 用户 | `{mode: 'soc'|'full'}` → 更新后策略 | `socAuth.setActionMode` |
| `get-settings` | 管理员 | `{}` → 脱敏服务状态（含 `official_mcp_enabled`） | `runAdmin` |
| `update-settings` / `delete-setting` | 管理员 | 恒 `bad-request` — "Service configuration is managed by the server environment." | `host.js` |
| `list/add/update/delete/test-account` | — | 恒拒绝 — "Stored Zimbra accounts are no longer supported" | 遗留桩 |
| `send-email` | 用户 | `{to[], cc[], bcc[], subject, body, body_format[, forward_message_id]}` → UI 要求 `{sent: true}` | `runAuthCommand('send-email', {…, session_id})` |
| `list-signatures` | 用户 | `{}` → `{signatures: [{id,name,text,html}]}` | `runAuthCommand` |
| `test-splunk` / `test-subscription-server` | 管理员 | `{}` → 状态/失败。`test-splunk` **经桥接实时执行 `splunk_get_info`**（185 秒预算、Bearer 脱敏）；订阅检查保持管理 CLI 子进程 | `host.js`、`splunk-bridge.js` |
| `convert-attachment` | 管理员 | `{filename, content_type, data(base64), limits}` → `{text, text_truncated?…}`；≤100 MB、≤2 M 字符、文件名 ≤255 | `validateAttachmentPayload` + admin_cli |
| `migrate` | 管理员 | `{}` → schema 迁移结果 | `runAdmin` |

## 4. MCP 边界

- **`soc_agent`**（宿主为 MCP 客户端）: stdio；每调用元数据 `{soc_session_id, soc_investigation_id, soc_customer_id:"", soc_correlation_id, soc_deadline_ms}`；185 000 ms 每调用超时；启动失败致命。响应为 `{ok, service, operation, data|error{code,message,retryable,details}, meta}` 信封。
- **`splunk_mcp`**（宿主为**外部**服务器的 MCP 客户端）: streamable HTTP + Bearer；13 工具原始允许列表；结果经投影（掩码、50 KB 截断）。
- **harness→工具策略接口:** `tools/pre-execute` 的 `{kind: 'deny'|'ask'}` / delegate；harness 审批插件（fail-closed `ask`）把 `approval/request` 派发到 UI。

## 5. 私有控制通道（Node ⇄ Python）

- 传输: stdio JSON 行；首行 `{"ready":true}`；请求 `{id, command, payload}`；响应 `{id, ok, result}` / `{id, ok:false, error:{…}}`。
- 边界: 8 000 000 字节行上限（溢出杀通道）、8 并发、60 秒启动握手、每操作 185 秒默认超时。
- 命令: `login`、`logout`、`send-email`（含 `forward_message_id`）、`list-signatures`（分发表 = `auth_cli.dispatch_command`）；`zimbra_auth_error` 触发会话过期清理。
- 兜底规则: 仅**传输前**失败才回退一次性 `auth_cli`；传输后丢响应抛 `operation_outcome_unknown` 且绝不重放。
- 认证: 无通道机密（私有管道）；每命令的 `session_id` 对 Postgres 校验。

## 6. 外部服务调用

| 调用 | 发起方 | 协议/认证 | 错误 |
|---|---|---|---|
| Zimbra SOAP（`/service/soap`；上传 `?fmt=raw`） | `zimbra.py` via `zimbra-client` | XML over HTTPS（`ZIMBRA_HOST`），按调用会话令牌 | `zimbra_auth_error`（删应用会话）、`zimbra_tls_error`、`zimbra_connection_error`（可重试）、`zimbra_api_error`、`query_validation_error` |
| 订阅 REST（`/login`、`/api/subscriptions[…]`） | `email/service.py` | httpx；表单登录；≤5 同主机重定向、不降级 | `email_server_unavailable`（可重试）、`email_server_auth_failed`、`email_server_request_failed`（仅状态码）、`email_server_invalid_response` |
| 官方 Splunk MCP | `splunk-bridge.js` | streamable HTTP + Bearer；端点 URL 校验；TLS 默认校验；管理探针 = 真实 `splunk_get_info` 调用 | 连接/超时失败记日志；配置后启动失败致命 |

## 7. 存储接口

- **PostgreSQL**（`SocStateStore`、`PostgresStore`）: 见 [DATA_STORE_CATALOG.md](DATA_STORE_CATALOG.md)。存储缺失 → `authentication_required` 失败关闭。
- **Schema 迁移**（`schema.py apply_migrations`）: advisory 锁下的版本化 SQL；版本台账 `soc_schema_migrations`；存储启动、`ensureSchema`、管理 `migrate` RPC 三处触发。
- **harness 设置 API**（`settings.get/mutate`、命名空间 + `expectedRevision`）: 动作策略、背景节奏、附件限额、提供商的持久化。
- **credentials API**（`credentials.set/unset/describe`）: 只写机密存储；`describe` 仅返回 configured/writable。

## 8. UI 交接边界

- **邮件草稿交接:** 草稿工具结果（草稿 JSON，转发含 `forwarded_message`）→ `EmailDraftToolview` 渲染可编辑表单 → 显式确认 → `send-email` RPC → `{sent:true}` 或失败卡。无其他投递路径；无模型可调用发送。
- **附件边界:** 编辑器文件 → base64 → `convert-attachment`（管理 RPC）或邮箱 `zimbra_get_attachment_text` → MarkItDown Markdown（`text_truncated` 标记）→ 模型上下文。
- **浏览器 bundle 边界:** `lib/client.js` 闭包工厂经 `window.__ModuleLoader__` + `__DSH_BOOT__` 图加载（harness `packages/client/web/src/boot.ts`）。

## 9. 到 vendored harness 的补丁接缝

- `apps/soc-agent/cordis.patch.yml`: 启用/禁用上游插件行、设置 `approval.policy: ask`、禁用模型可见编码工具、插入五个 SOC 插件、配置两个 MCP 服务器（原始允许列表、超时）、把 `skill-filesystem.customSkillDirs` 指向 `<repo>/skills`。
- `patches/dsh-auto-collapse@0.1.4.patch`: 对上游 UI 插件构建 bundle 的 pnpm 补丁 — 英文本地化、英文时长解析、`[data-dshcf-preserve]` 行豁免自动折叠。
- 上游 schema 接缝: `packages/host/apiproxy/src/api/rpc.schema.ts` 现声明结构化 `authentication-required`/`admin-authentication-required` RPC 错误码（含测试）。
- 预设接缝: `vendor/.../agent-presets/citic-soc/agent.cordis.yml` — 人格 "Sentinel"、`instructionFileCandidates`（AGENTS/CLAUDE/BACKGROUND，64 KiB 上限）、压缩阈值（8192/4096/1024）、`tool-ask-user`。
