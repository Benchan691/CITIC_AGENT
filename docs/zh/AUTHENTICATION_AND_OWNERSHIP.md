# 认证与归属权（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../AUTHENTICATION_AND_OWNERSHIP.md)

**本页读者:** 安全评审者与改动身份相关代码的开发者。

**读完后你将了解:** 全部认证机制、服务端身份如何建立与传播、按用户隔离如何强制执行（含精确的归属检查）、管理员层的差异、凭据处理与加密、会话生命周期，以及每一条拒绝路径。

**通俗概述。** 系统有两类主体：分析师（经 Zimbra 验证，24 小时 Postgres 会话，Cookie `soc_session`）和管理员（静态环境凭据，8 小时内存会话，Cookie `soc_admin_session`）。登录时确立的身份 — 绝不是提示词或工具结果里的任何东西 — 被附加到每次 MCP 调用与每个 API 请求，一个受限代理让 harness 自身的 API 变得按用户安全。所有拒绝路径一律失败关闭。

**前置要求:** [ARCHITECTURE.md](ARCHITECTURE.md) §2；流程见 [RUNTIME_FLOWS.md](RUNTIME_FLOWS.md) §3–4。

---

## 1. 认证机制（已验证）

| 机制 | 主体 | 验证方式 | 存储 | Cookie |
|---|---|---|---|---|
| 分析师登录 `/auth/login` | Zimbra 用户 | 凭据由 **Zimbra** 经 Python 验证（`auth_cli login` → `zimbra_login` SOAP）；邮箱规范化（`normalize_zimbra_email`） | `soc_app_sessions`（24 h；Zimbra 令牌 Fernet 加密） | `soc_session`：`HttpOnly; SameSite=Lax; Max-Age=86400; Path=/` + 检测到 HTTPS 时加 `Secure` |
| 管理员登录 `/admin/auth/login` | 静态管理员 | `SOC_ADMIN_EMAIL` 相等 + `timingSafeEqual` 密码比较（先比长度）；**启动时必需** — 缺失即抛错 | 内存 Map，以 SHA-256(令牌) 为键；8 h TTL；宿主重启即登出 | `soc_admin_session`，同标志，`Max-Age=28800` |

两条登录路由的加固：同站/Origin 检查（`sec-fetch-site: cross-site` 与 `Origin`/`Host` 不匹配 → 403）、仅 POST（405）、仅 JSON（415）、32 KiB 请求体上限（400）。失败折叠为固定消息（`invalid email or password` / `authentication_failed`）— 密码永不回显，Python 的通用 `authentication_failed` 防止用户名枚举。

**单设备策略:** 每次新登录撤销该用户其他活跃会话（`reason: "new_device_login"`）、中断其事件流、取消其聊天代理（经父会话闭链包括子代理）、清空其会话级动作模式。被顶设备通过一次性 `soc_session_revocations` 行恰好得知一次原因："A new device logged in to this account. You have been signed out."

## 2. 服务端身份权威

经认证的服务端用户身份是权威。具体而言：

- 模型提示词、检索到的邮件、Splunk 事件、工具结果**都不能**选择或更改应用用户。任何 MCP 工具都没有用户参数（`test_server_tools.py` 断言无 `ctx`/`account_id` 参数）。
- 每次 MCP 调用由宿主注入元数据（`mcp/request-meta`）：`soc_session_id`（应用会话）、`soc_investigation_id`（agent/会话 id）、`soc_customer_id`（**恒为空** — 占位符，不是选择器）、`soc_correlation_id`（新 UUID）、`soc_deadline_ms`（now + 180 秒）。
- Python 服务器把 `soc_session_id` → `identity_for_session(store, session_id)` → `ZimbraIdentity{user_id, zimbra_email, zimbra_token, session_id}`。存储缺失 → `authentication_required`；未知/过期 → `session_expired`。
- Zimbra 操作**以该身份**执行。传入其他 `account_id` 会触发 `account_selection_disabled`（"Zimbra uses the authenticated user's account."）；运行时账户存储是无操作（`_EmptyAccountStore`），持久化邮箱凭据永不可被选中。

## 3. 请求路由与权限分层

- `installTransport` 圈起私有面：精确 `/api` 路由与 `/soc-agent-*` 之下的一切都需要有效主体；WebSocket 升级 `/api/events.mux`、`/api/events.host` 需要会话。
- **特权 API 方法**（`PRIVILEGED_API_METHODS`：预设、宿主目录访问、settings、credentials、`llm.discoverModels`）要求**管理员**主体。用户 Cookie 访问这些路径 → 403 `forbidden`；无 Cookie → 401。
- **混合方法**（`llm.providers`、`llm.models`）与 `/soc-agent-config` RPC 二者皆可，再由各端点单独执行 `requireUser` / `requireAdmin`。
- 主体经 `AsyncLocalStorage` 按请求绑定（用户与管理员分用两个存储）。
- `connectionAuthorization.authorizePrivilegedRequest` 在连接层门控受信宿主通道本身（仅管理员）。

## 4. 归属权模型（按用户隔离）

**归属声明**是 Postgres 中的一等行 — 不是从命名推导的：

| 表 | 声明 | 写入路径 |
|---|---|---|
| `soc_workspace_owners` | 工作区 id → 用户（+ 路径） | `claimWorkspace`（同主保护的 upsert）：登录（`ensureGeneral`）或建工作区时 |
| `soc_session_owners` | 会话 id → 用户 + 工作区 | `claimSession` — 仅当工作区属于同一用户才插入；`ON CONFLICT DO NOTHING` 后复核 |
| `soc_folder_owners` | 文件夹 id → 用户 | 先到先得 |

**受限 API 代理**（`createScopedApiProxy`）包装九个 harness API 域。每次调用它：授权 id（跨用户即拒 — 11 个变更方法有测试）；规范化输入（服务端生成 `session-<uuid>`；默认 General 工作区；`folderId` 必须已归属）；过滤读取结果（工作区/会话/文件夹列表；外来快照 id 丢弃）；以及 `respond` 守卫 — 审批/问询答复只能解析调用者自己的挂起请求。工作区文件系统包含性：`workspace.create` 只接受单个目录名（拒绝绝对路径、`.`、`..`、分隔符、NUL → `workspace-invalid-path`），解析到 `MCP_SERVER_ROOT/.data/soc-workspaces/<userId>/` 下，然后 `mkdir` + `realpath` 规范化 + `isWithinPath` 包含性（阻断穿越与符号链接逃逸）。"General" 工作区禁止改名/删除（`workspace-protected`）。

**会话归属**要求 `soc_session_owners` 行**与其父 `soc_workspace_owners` 行**都归属该用户（`sessionBelongsToUser`）。

## 5. 事件流限域与脱敏

实时帧（`/api/events.mux`、`/api/events.host`）按消费者过滤：引用他人会话/工作区的帧被丢弃或 id 过滤；携带 `credentials/reference-updated` 的 `host/remote-event` 被改写为无参的 `llm/adapters-updated`（用户无从得知凭据引用名）；其余未投影的 `host/remote-event` 全部丢弃；`stream/error` 帧替换为通用 "event stream unavailable"。若消费者的应用会话不再属于它，流终止。`events.mux` 的 `since` 游标在分发前先过滤为本人会话。审批与问询请求把调用者登记为唯一合法应答者。

## 6. 凭据处理与加密

| 机密 | 位置 | 保护 |
|---|---|---|
| Zimbra 会话令牌 | `soc_app_sessions.zimbra_token_encrypted` | Fernet（`APP_SETTINGS_ENCRYPTION_KEY`；合法密钥原样使用，否则 SHA-256 派生）。Node 查询刻意省略该列；`public_session` 永不序列化 |
| 管理员密码 | 仅 `SOC_ADMIN_PASSWORD` 环境变量 | 启动时必需；时间安全比较；会话令牌在内存中仅存 SHA-256；**从所有子进程环境剔除**（`python-command.js`、`env_loader.py`） |
| 设置（`app_config`） | Postgres | 逐值 Fernet 加密；密钥不匹配抛出带修复指引的错误 |
| 提供商 API key | credentials API | 只写：`credentials.set`；`describe` 只返回 configured/writable；界面显示 "Stored securely · enter a new key to replace it" |
| 服务机密（Splunk 令牌、订阅密码、MarkItDown key） | `.env` 文件（chmod 600） | `public_status` 脱敏（`redact_endpoint`）；订阅客户端不外泄远端错误体；连接检查错误中的 Bearer 令牌脱敏 |
| 会话 id 的 SQL 面 | — | 任意查询前按 `^[A-Za-z0-9_-]+$`（≤128 字符）校验 |

## 7. 会话生命周期与拒绝场景

- **过期:** 服务端强制；过期行在读取时惰性删除；`/auth/me` 返回 `expires_at`；浏览器每 30 秒及 focus/visibility 时轮询以感知过期。
- **登出:** 删除 DB 会话、解绑/中止 agent 会话、清除 Cookie（`Max-Age=0`）。
- **宿主重启:** 分析师会话存活（Postgres）；管理员会话与会话级动作模式不存活（内存）。内存撤销状态重启即失 — 这正是 `soc_session_revocations` 表存在的原因。
- **拒绝场景（失败关闭）:** 未认证访问 `/soc-agent-config` → `authentication-required`；用户访问管理端点 → `admin-authentication-required`（403）；缺 Postgres → Python 抛 `authentication_required`（登录事实上不可能）；会话过期/未知 → `session_expired`；上游令牌失效 → `zimbra_auth_error` 删除应用会话；跨站请求 → 403。

## 8. 界面决策 vs 服务端强制

| 控制项 | 界面 | 服务端 |
|---|---|---|
| 登录遮罩 | 覆盖 shell | 路由 + 传输圈栏独立强制 |
| 动作模式切换 | 便利项 | `set-action-mode` 服务端校验；会话内存映射；策略门强制 |
| 每工具 ask/auto/disabled | 管理清单 UI | `tools/pre-execute` 依据（加密）设置强制 |
| 邮件 Send 确认 | **界面级**（`window.confirm`） | 服务端强制认证、会话身份、`ZIMBRA_ALLOW_SEND` 门与 Zimbra 回执 — 但没有服务端确认令牌（见 [TRACEABILITY_MATRIX](../reference/TRACEABILITY_MATRIX.md) #34） |
| 只写凭据 | 密码输入框 | `credentials.describe` 只返回布尔 |

## 仓库中的证据

- `apps/soc-agent/ownership.js`（认证服务、受限代理、控制通道）、`auth-host.js`（装配、元数据）
- `apps/soc-agent/server/unified_mcp_server/auth.py`、`postgres_store.py`、`auth_cli.py`
- 测试: `auth.test.js`（10）、`user-mode.test.js`、`test_auth.py`（4）、客户端 `action-policy.test.ts`
- 时序图: [diagrams/authentication-sequence.mmd](../diagrams/authentication-sequence.mmd)；英文站可交互版本见 [site/security.html](../site/security.html)

## 未知项

- 反向代理下的行为（Cookie `Secure` 依赖 `x-forwarded-proto`）取决于部署拓扑，本仓库未配置。
- Zimbra 自身的会话/令牌寿命是外部的，可能早于 24 小时结束（表现为 `zimbra_auth_error` → 重新登录）。
