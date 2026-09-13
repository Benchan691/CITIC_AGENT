# 组件目录（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../../reference/COMPONENT_CATALOG.md)

**本页读者:** 需要一览每个组件的职责、边界与测试覆盖的开发者、评审者与安全评估者。

**读完后你将了解:** 每个第一方组件以同样的字段描述 — 目的、归属、入口、输入/输出、状态、信任级、依赖、测试、运行状态 — 便于比较与评估改动影响。

**通俗概述。** 系统是一组协作组件：隔离的浏览器表面包、强制 SOC client core 与六个可选功能包、运行产品插件的 Node 宿主（基于纯净 vendored harness）、带 Zimbra/订阅工具的 Python MCP 服务器子进程、连到外部 Splunk MCP 服务器的客户端桥接、认证操作控制通道、管理 CLI、PostgreSQL 持久化。相关页: [REPOSITORY_MAP.md](REPOSITORY_MAP.md)（文件分类）、[TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md)（论断级证据）。

**运行状态图例:** **活跃** · **条件性**（配置后启用）· **仅管理员** · **已移除**（本轮删除，原"保留"）· **生成** · **运维工具**。

---

## 1. SOC 浏览器包（分析师 UI）

- **强制核心 `packages/soc-agent-client/`:** 认证遮罩、`SocClientRuntime`/`socClient` service、action-policy schema、`/admin` root takeover 与安全回退；不拥有可选功能 UI，也不导入官方或隔离的 sidebar/workspace 实现。
- **隔离表面 `packages/soc-agent-sidebar/`、`packages/soc-agent-workspace/`:** 唯一启用的 root sidebar owner、工作区浏览/选择器、标准子槽位与固定样式；workspace 包拥有可恢复的 `api.folders` 守卫。
- **可选包:** `soc-agent-brand`（品牌）、`soc-agent-admin`（管理台）、`soc-agent-action-policy`（用户模式菜单）、`soc-agent-attachments`（MarkItDown）、`soc-agent-email-draft`（草稿/转发 tool view）、`soc-agent-auto-collapse`（对话自动折叠）。各包只拥有自己的槽位、command、provider 或设置。
- **输入/输出:** harness 槽位与 service、`/soc-agent-config`、认证 HTTP 路由，以及各包需要的 settings/connection/conversation/command/toolview API。
- **信任级:** 不可信客户端。所有强制在服务端。
- **构建/输出:** 36 个 SOC 包加 `apps/soc-agent` 产品 bundle 由同一 setup 矩阵跟踪；其中 26 个包面生成浏览器产物。setup 统一做指纹、构建、注册、解析与健康检查。
- **运行状态:** core/sidebar/workspace 与基础替代包强制；六个可选包默认启用且可独立禁用。

## 2. 管理控制台功能（`dsh-soc-agent-admin`，浏览器 `/admin`）

- **路径:** `packages/soc-agent-admin/src/client/AdminConsole.tsx`、`packages/soc-agent-client/src/client/core/AdminUnavailable.tsx`
- **职责:** 独立管理面：服务状态、智能体上下文、访问与审批、只写凭据的 AI 提供商。
- **入口:** 核心拥有 `/admin` root 并注入 `soc.admin.content` 子槽位；本功能包填充该槽位；由 `host.js` 路由 `GET /admin` 服务。
- **输入/输出:** `/admin/auth/me|login|logout`；RPC `get-settings`、`test-splunk`（实时桥接探测）、`test-subscription-server`、`get-admin-action-catalog`；settings/credentials/LLM API。
- **状态:** 经 `settings.mutate` + `expectedRevision` 乐观并发的设置命名空间。
- **信任级:** 服务端逐端点要求管理员；机密只写。
- **测试:** `packages/soc-agent-admin/tests/admin-console.test.ts`、`sections.test.ts`。
- **运行状态:** 默认活跃、仅管理员、可独立禁用；禁用时保留核心安全回退页。

## 3. SOC 宿主插件（`soc-agent-admin-host` → `dsh-soc-agent/host`）

- **路径:** `apps/soc-agent/host.js`、`tool-inventory.js`、`policy.js`、`investigation.js`
- **职责:** 策略与产品 RPC 大脑：精确工具允许列表、动作模式与每工具状态、`/soc-agent-config` 端点、背景刷新、Splunk 输出投影、管理页与管理子进程。
- **归属:** 决定每次工具调用的 allow/deny/ask；拥有动作目录词汇（单一来源 `tool-inventory.js`，策略与桥接共同导入）。
- **入口:** cordis `apply(ctx)`；钩子 `tools/pre-execute`（全局）、`tools/post-execute`（投影）、`agent/created`、`agent/pre-step`（背景）；RPC 通道 `/soc-agent-config`。
- **输入/输出:** 入：工具调用裁决、RPC 请求、设置；出：deny/ask/delegate 裁决、管理子进程（`runPythonCommand`）、`test-splunk` 走 `testOfficialSplunkConnection`。
- **状态:** 设置键 `soc-action-approval`；`soc-background`；读 `BACKGROUND.md`（≤1 MiB 源，64 KiB 渲染）。
- **信任级:** 可信宿主边界 — 主要允许列表执行点。
- **测试:** `policy.test.js`（精确计数 **30/42/12**）、`background.test.js`、`investigation.test.js`、`user-mode.test.js`。
- **运行状态:** 活跃。

## 4. 认证宿主插件 + 归属边界

- **路径:** `apps/soc-agent/auth-host.js`、`ownership.js`
- **职责:** 认证用户（Zimbra 凭据）与管理员（静态环境凭据）；在每次 API 上强制按用户的工作区/会话归属；注入每次 MCP 调用的元数据；圈栏私有路由。
- **入口:** `apply(ctx)`；HTTP 路由 `/auth/*`、`/admin/auth/*`；`installTransport`（圈栏 `/api` 与 `/soc-agent-*` 路由及 `/api/events.mux|host` 升级）；`mcp/request-meta` 钩子（全局）；`connectionAuthorization.authorizePrivilegedRequest`。
- **状态:** Postgres（`SocStateStore`：用户、加密 Zimbra 令牌的会话、撤销、归属声明、bootstrap）；内存管理员会话（SHA-256 哈希令牌，8 h）与会话动作模式映射；工作区在 `MCP_SERVER_ROOT/.data/soc-workspaces/<userId>/`。**Schema 由 Python 迁移拥有**（`ensureSchema` 调 `schema migrate`，URI 走 stdin）。
- **信任级:** Node 层的身份与隔离边界。管理凭据不进入任何子进程。
- **测试:** `auth.test.js`（10）、`user-mode.test.js`、`control-channel.test.js`。
- **运行状态:** 活跃。无 `APP_POSTGRES_URI` 时存储空操作，应用登录失败关闭。

## 5. Python MCP 服务器（`soc_agent`）

- **路径:** `apps/soc-agent/server/unified_mcp_server/`（入口 `server.py`；包 `soc-agent-mcp`；脚本 `unified-mcp-server`）
- **职责:** 经 MCP stdio 暴露精确 **28** 个域工具（13 邮件含转发草稿、9 过滤器、6 订阅），以每请求认证身份与 180 秒操作预算执行。
- **入口:** `dsh-mcp-client` 按 `cordis.patch.yml` 拉起（原始允许列表 28、`toolCallTimeoutMs: 185000`、`failOnStartupError: true`）。
- **输入/输出:** 入：带元数据的 MCP 调用；出：`success`/`failure` 信封；SOAP 到 Zimbra；HTTPS 到订阅；Postgres 读。
- **状态:** Postgres 应用会话（令牌解密）、LRU 32 的身份绑定邮件服务；**不持久化草稿**。
- **信任级:** 以认证用户的 Zimbra 令牌执行；拒绝 `account_id` 选择。
- **测试:** 10 个 Python 测试文件 / 48 测试，含 `test_server_tools.py`（精确 28 工具面）与 `test_schema.py`（迁移）。
- **运行状态:** 活跃（配置后拉起失败即致命）。

## 6. Zimbra 域服务

- **路径:** `unified_mcp_server/zimbra_service.py`、`zimbra/{zimbra.py, core/, mail/, filters/}`
- **职责:** 对认证用户邮箱的 SOAP 访问：文件夹、搜索、读取、头部、附件文本、签名、移动、草稿（含**转发草稿**）、过滤器。
- **输入/输出:** SOAP `{ZIMBRA_HOST}/service/soap`（`zimbra-client`），每次调用携带会话令牌；`zimbra_forward_message` 在发送路径投递原信与附件。
- **信任级:** 身份绑定；拒绝账户选择；环境门 `ZIMBRA_ALLOW_SEND|MOVE|FOLDER_WRITE|SIGNATURE_WRITE|FILTER_WRITE|FILTER_REDIRECT|FILTER_DISCARD`。
- **测试:** `test_zimbra_service.py`（14，含转发）、`test_zimbra_filters.py`（4）。
- **运行状态:** 活跃。

## 7. 订阅服务客户端

- **路径:** `unified_mcp_server/email/{service.py, tools.py}`
- **职责:** 外部邮件订阅服务管理：列出、Schema、预览、创建、更新、删除。
- **入口:** `server.py` 的 `register_email_tools`；管理 `test-subscription-server`。
- **输入/输出:** `httpx.AsyncClient` 到 `SUBSCRIPTION_SERVER_URL`；手动重定向校验（≤5、同主机、不降级）；401 时恰好重登一次。
- **测试:** `test_email_service.py`（3）。
- **运行状态:** 活跃（未配置时 `not_configured`）。

## 8. Splunk 桥接（`splunk-official-mcp` → `dsh-soc-agent/splunk-bridge`）

- **路径:** `apps/soc-agent/splunk-bridge.js`
- **职责:** 连接外部官方 Splunk MCP 服务器并把其工具以 `splunk_mcp` 命名空间注册，限 13 个读工具（从 `tool-inventory.js` 导入）。
- **入口:** `apply(ctx)`；端点 URL 校验（无凭据/查询/片段；明文 HTTP 需选择）；端点+令牌缺失时禁用（打印日志，不注册）。**setup 与 `--check` 要求此连接。** 另有 `testOfficialSplunkConnection` — 管理连接检查现在实时执行 `splunk_get_info`。
- **输入/输出:** streamable HTTP + Bearer；`verifyTls` 默认 true；超时 185 s；`failOnStartupError: true`。
- **信任级:** 外部服务边界；结果先经投影（脱敏+截断）再入模型。
- **测试:** `splunk-bridge.test.js`（4）、`skills.test.js`。
- **运行状态:** 条件性（未配置即关闭）。

## 9. 调查投影

- **路径:** `apps/soc-agent/investigation.js`
- **职责:** 官方 Splunk 结果的最后输出边界：合并文本块、掩码卡号/SSN、50 KB 截断（带显式标记）。
- **入口:** `ctx.on('tools/post-execute', …, {global: true})`；仅前缀 `mcp__splunk_mcp__splunk_`。
- **退出项:** `SPLUNK_SANITIZE_OUTPUT=0|false|no|off`。
- **测试:** `investigation.test.js`。
- **运行状态:** 活跃。

## 10. 控制通道 + 认证操作

- **路径:** `ownership.js`（`runAuthCommand`、`startControlChannel`）、`control_server.py`、`auth_cli.py`
- **职责:** **不可被模型调用**的会话级邮件操作：`login`、`logout`、`send-email`（现支持 `forward_message_id` 转发投递）、`list-signatures`。
- **入口:** 常驻子进程 `uv run python -m unified_mcp_server.control_server`（stdio JSON 行；60 秒握手；8 MB 行上限；8 并发；每操作 185 秒）；`SOC_CONTROL_CHANNEL=off` → 一次性 `auth_cli`；仅在**传输前**失败才回退；歧义结果抛 `operation_outcome_unknown` 且绝不重放。
- **信任级:** 私有父子管道（无通道机密）；授权 = 载荷中的 `session_id` 对 Postgres 校验。
- **测试:** `control-channel.test.js`、`test_control_server.py`。
- **运行状态:** 活跃。

## 11. 管理操作路径

- **路径:** `host.js`（`runAdmin` → `python-command.js`）、`admin_cli.py`
- **职责:** 仅管理员的服务操作（一次性子进程）：`get-settings`、`test-subscription-server`、`convert-attachment`、`migrate`（应用 SQL 迁移）。`test-splunk` 已移出 CLI — 宿主直接实时探测桥接。按设计拒绝设置写入、账户管理、邮件操作。
- **信任级:** RPC 端点要求 `requireAdmin`；`SOC_ADMIN_*` 从子环境剔除；失败解析 stderr JSON（≤400 字符、≤20 个缺失变量）；185 秒超时 → SIGTERM。
- **运行状态:** 活跃，仅管理员。

## 12. 持久化层

- **路径:** `postgres_store.py`、`schema.py` + `migrations/*.sql`、`account_store.py`、`ownership.js`（`SocStateStore`）
- **职责:** 加密配置、认证会话、归属声明；遗留本地账户文件。**Schema 由版本化 SQL 迁移拥有**（advisory 锁、`soc_schema_migrations` 台账）；Node 层无 DDL。
- **状态:** `soc_users`、`soc_app_sessions`（加密 Zimbra 令牌）、`soc_session_revocations`、`soc_workspace_owners`、`soc_session_owners`、`soc_folder_owners`、`soc_bootstrap`、`soc_schema_migrations`、`app_config`（Fernet）、`zimbra_accounts`（遗留，002 迁移删除其目录表族）。
- **信任级:** Postgres 配置启用时必需 `APP_SETTINGS_ENCRYPTION_KEY`；解密失败抛出带修复指引的错误。
- **测试:** `test_postgres_store.py`、`test_account_store.py`、`test_auth.py`、`test_schema.py`。
- **运行状态:** 活跃（无 URI 时 Node 存储退化；Python 存储为 None）。

## 13. 已移除的 Splunk 实现

- **路径:** 无（本轮删除）。此前为 `unified_mcp_server/splunk/`（34 文件）、`splunk_service.py`、`detection.py` — 完整进程内 Splunk 实现（REST 客户端、防护、查询策略、资源治理、规划/证据/校验器、CITIC 检测编译器、安全队列）加 SQLite 证据存储。
- **替代者:** 官方 MCP 桥接现在是*唯一* Splunk 路径；管理连接检查实时探测它；`test_server_tools.py` 仍断言 `soc_agent` 上无 `splunk_*` 工具。
- **对技能的后果:** `detection-engineering`、`spl-writing`（及 `false-positive-analysis` 部分）引用的工具已不存在 — 审计记录为漂移。CITIC 编译/回测能力已从应用中彻底消失；维护者的 `docs/SHORTENING_PLAN_IMPLEMENTATION.md` 记录了退役决策。
- **磁盘残留**（`splunk/`、`catalog/` 目录）可安全删除。

## 14. Vendored harness 集成面

- **路径:** 纯净 `vendor/deepseek-harness/`（`dsh-v0.1.5-rc.2`，提交 `fb2c4b9e698e30edb738bca4cf0618587db7d203`）、`vendor/deepseek-harness.upstream.json`、`apps/soc-agent/cordis.patch.yml`、根目录 `packages/soc-agent-*`
- **职责:** 智能体运行时：cordis 插件加载器、失败关闭审批的工具注册表、MCP 客户端（stdio + streamable-http、重连退避、`allowedToolNames` 过滤、`toolCallTimeoutMs`）、web 服务器/网关、浏览器模块加载器、技能、预设、LLM 提供商。
- **本轮变更:** `packages/host/apiproxy` 上游声明结构化认证错误码。
- **钉扎:** `tooling/verify-upstream.mjs` 将 vendor 目录与官方 release archive 比较；其中不得有 SOC 源码、profile 补丁或 vendor-relative workspace link。根 SOC workspace 精确钉扎 `0.1.5-rc.2` Harness 依赖并记录源文件清单。
- **运行状态:** 活跃（纯净 vendored 上游）。

## 15. setup doctor + 更新器

- **路径:** `setup.sh`、`update.sh`、根 `package.json`、`pnpm-workspace.yaml`、`tooling/session-migration.mjs`
- **职责:** 引导/修复/装配一切：前置（node ≥22.19/24、pnpm、uv）、单一参数清单（官方 Splunk MCP 端点+令牌**必填**）、`.env` 生成（chmod 600）、`uv sync`、指纹门控 `pnpm install/build`、插件添加/清理、SOC bundle 注册、校验。`update.sh` = 干净树 ff-only 拉取 + `setup.sh --plugins`。
- **运行状态:** 运维工具（运维执行；不启动服务）。

## 16. 技能

- **路径:** `skills/{detection-engineering,false-positive-analysis,splunk-investigation,spl-writing}/SKILL.md`
- **职责:** 模型选择的手册，约束调查、误报分析、检测工程与 CITIC SPL 编写；经 `skill-filesystem`（`customSkillDirs` → `<repo>/skills`）加载，由 `tool-skill` 工具呈现（`skill` 在 `READ_ONLY_TOOLS`）。
- **运行状态:** 活跃（内容）。漂移: `AGENTS.md` 另列三个无文件技能；两个现有技能引用已移除工具（见 [DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md)）。
