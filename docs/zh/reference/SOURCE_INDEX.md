# 源码索引（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../../reference/SOURCE_INDEX.md)

**本页读者:** 定位代码、识别跨边界符号的开发者。

**读完后你将了解:** 每个被跟踪第一方源文件的一句话用途与重要导出。分类见 [REPOSITORY_MAP.md](REPOSITORY_MAP.md)；职责见 [COMPONENT_CATALOG.md](COMPONENT_CATALOG.md)。本轮删除的文件（Python Splunk 栈、两个客户端状态卡、`hi.txt`）列于 [REPOSITORY_MAP.md](REPOSITORY_MAP.md) "What changed"，其符号有意不在本索引中。

---

## 根目录

| 文件 | 用途 | 关键符号/事实 |
|---|---|---|
| `setup.sh` | setup doctor: bootstrap、`--check`、`--plugins`、`--rebuild` | `run_prereq_checks`、`collect_parameters`、`write_files`、`ensure_python_server`、`ensure_harness_ready`、`ensure_soc_workspace_ready`、`ensure_soc_bundle`、`SOC_PACKAGE_MATRIX`（37 个包 / 26 个浏览器 face）；Splunk 参数仅 MCP |
| `update.sh` | 干净树 ff-only 更新 + `setup.sh --plugins` | 拒绝参数；从不 stash |
| `package.json` | 根 workspace 与构建策略 | 固定 `pnpm@11.7.0`、Node engine、声明/构建/类型检查/测试/校验脚本 |
| `pnpm-workspace.yaml` | 独立 SOC workspace 定义 | 根 workspace 包；无 vendor-relative link |
| `vendor/deepseek-harness.upstream.json` | 不可变 Harness 来源 | repository、`dsh-v0.1.5-rc.2`、`fb2c4b9e…`、文件 inventory SHA-256 |
| `tooling/session-migration.mjs` | 会话校验/迁移/回滚 CLI | `--validate`、`--migrate`、`--rollback`；fail-closed v0/v1/v2 审计与不可变 v3 successor 发布 |
| `AGENTS.md` | 智能体强制运行政策 | 身份、隔离、不可信内容、证据、邮件、Splunk、技能清单 |
| `BACKGROUND.md` | Splunk 参考背景（命名约定；保留客户示例） | 由 `host.js` 背景刷新注入 |
| `README.md` | 人工概览 | 链接 shortening 实施报告；MCP 必配 |
| `lefthook.yml` | 全注释示例；无活跃钩子 | — |

## `apps/soc-agent/`

| 文件 | 用途 | 关键导出/符号 |
|---|---|---|
| `tool-inventory.js` | 单一运行时无关工具清单 | `OFFICIAL_SPLUNK_TOOL_NAMES`（13 原始）、`TOOL_CATALOG`（26 条）、`SUBSCRIPTION_READ_TOOLS`（3）；头注释 "Draft preparation never delivers mail." |
| `policy.js` | 派生策略集（导入清单） | `OFFICIAL_SPLUNK_READ_TOOLS`（13）、`READ_ONLY_TOOLS`（30）、`ZIMBRA_READ_TOOLS`（13 派生）、`ACTION_CATALOG`（12 派生）、`ACTION_TOOLS`、`TOOL_CATALOG`（再导出）、`MANAGED_TOOL_NAMES`（25）、`DOMAIN_TOOLS`（42）、`APPROVAL_TOOLS` |
| `host.js` | 宿主插件: 策略门 + RPC + 背景 + 管理页 | `name 'soc-agent-host'`、`CHANNEL '/soc-agent-config'`、`handleEndpoint`、`requireUser/requireAdmin`、`savedActionPolicy`、`defaultActionState`、`installBackgroundRefresh`、`runAdmin`（→ `runPythonCommand`）、`validateAttachmentPayload`、`CONTROL_TOOLS` |
| `auth-host.js` | 认证插件装配 | `mcp/request-meta` 钩子（`soc_session_id`、`soc_investigation_id`、`soc_customer_id: ''`、`soc_correlation_id`、`soc_deadline_ms`）、`ctx.provide('socAuth')`、`connectionAuthorization` |
| `ownership.js` | 认证/归属边界 | `SocAuthService`、`SocStateStore`（`ensureSchema` → Python `schema migrate`、URI 走 stdin）、`createScopedApiProxy`（9 域）、`runAuthCommand`、`startControlChannel`、`resolveAdminCredentials`、`sameSiteRequest`、`isWithinPath`、`userWorkspaceRoot` |
| `python-command.js` | 共享一次性 Python 运行器 | `pythonEnvironment()`、`runPythonCommand({module, command, arg, payload, timeoutMs, signal, mapError})` |
| `splunk-bridge.js` | 外部 Splunk MCP 客户端桥 | 从清单导入 `OFFICIAL_SPLUNK_TOOL_NAMES`；`resolveOfficialSplunkConfig`（URL 校验；`serverName: 'splunk_mcp'`）；`testOfficialSplunkConnection`（live `splunk_get_info` 探测、令牌脱敏）；`apply(ctx)` |
| `investigation.js` | Splunk 输出投影 | `projectOfficialSplunkResult`（50 KB 截断）、`sanitizeSplunkText`（`SPLUNK_SANITIZE_OUTPUT` 退出项）、`installInvestigationProjection` |
| `cordis.patch.yml` | 产品补丁清单 | 禁用所有映射的官方实现，插入 SOC 替代名册，保持 session folders/directory picker/Open In/subagent extras 禁用，配置 MCP/approval/skills，并启用六个可选 client 行 |
| `package.json` | bundle 清单 | `dsh-soc-agent`；`./tool-inventory`、`./python-command` 等导出 |

## `apps/soc-agent/server/unified_mcp_server/` — 活跃服务器

| 文件 | 用途 | 关键符号 |
|---|---|---|
| `server.py` | FastMCP 服务器 + 请求执行（28 工具） | `create_server`、`Runtime`、`_EmptyAccountStore`（自 core 导入）、`execute`、`fresh_runtime`、`McpFailureEnvelope`、三个 `register_*_tools` 调用点、`main` |
| `config.py` | 设置（env-only） | `ServerSettings.from_env`、精简 `SplunkSettings`（5 字段）、`public_status`（`official_mcp_enabled`）、`ZimbraSettings`、`MarkItDownSettings`、`EmailServerSettings`、`redact_endpoint` |
| `schema.py` + `migrations/*.sql` | **版本化 SQL 迁移** | `apply_migrations(connection)`（advisory 锁、台账）、独立 `main()`（stdin URI）；`001_initial.sql`、`002_remove_catalog.sql` |
| `auth.py` | 身份模型 | `ZimbraIdentity`、`identity_for_session`、`public_session` |
| `request_context.py` | 操作预算/作用域 | `OperationContext`（`evidence_scope`）、`operation_budget`（min 180 s / deadline） |
| `postgres_store.py` | Postgres 持久化 | `PostgresStore.from_env`（启动 `apply_migrations`）、`create_user_session`、`get_app_session`、加密助手 |
| `account_store.py` | 遗留本地加密账户 | `AccountStore`（Fernet 文件、`0o600`、原子替换） |
| `errors.py` / `responses.py` | 错误/信封分类 | `ServiceError(code, message, retryable, details)`、`success`、`failure` |
| `blocking_io.py` | 有界线程卸载 | `BlockingIO.run`（全局 8 / 每主体 2、`asyncio.shield`）、`run_blocking` |
| `env_loader.py` | `.env` 加载 + 管理变量剔除 | `load_server_env`、`_NODE_ONLY_ENV_NAMES` |
| `zimbra_service.py` | Zimbra 域逻辑 | `ZimbraService.create_email_draft`、`send_email`（门）、`move_email`（校验+回滚）、`_upstream_error`、`_HEADER_NAMES`（12）、`_DEFAULT_HEADER_NAMES`（7） |
| `zimbra/zimbra.py` | SOAP 传输 | `soap_request`、`zimbra_login`、`zimbra_forward_message`（行 240）、`_validate_zimbra_host`、`zimbra_modify_filter_rules` |
| `zimbra/core/service.py` | 身份绑定 | `ZimbraCore.resolve_account`、`_EmptyAccountStore`（自本轮起供 `server.py` 使用） |
| `zimbra/mail/{service,tools}.py` | 邮件服务 + 13 工具 | `ZimbraMailService.create_forward_draft`（`forward_message_id` + `forwarded_message`）、`send_email(forward_message_id=…)`、`register_mail_tools` |
| `zimbra/filters/{model,service,tools}.py` | 过滤器 + 9 工具 | `ZimbraFilterService`（指纹、写门、redirect/discard 门） |
| `email/{service,tools}.py` | 订阅客户端 + 6 工具 | `EmailSubscriptionService`、`register_email_tools` |
| `attachment_converter.py` | MarkItDown 转换 | `AttachmentConverter.convert`（LRU 64/4 MB）、`AttachmentConversionLimits`、`_validate_archive_safety` |
| `control_server.py` | 常驻控制通道 | `ControlServer.serve`、`dispatch_command`、`_expire_session_on_auth_error` |
| `auth_cli.py` | 认证命令（分发表） | `dispatch_command`: `login`、`logout`、`send-email`（门 + `forward_message_id`）、`list-signatures` |
| `admin_cli.py` | 管理命令 | `get-settings`、`test-subscription-server`、`convert-attachment`、`migrate`（现执行 `migrate(store)` 应用迁移）；拒绝设置写入/账户/邮件 |

## `packages/soc-agent-*/` — 模块化浏览器包

| 文件 | 用途 | 关键符号 |
|---|---|---|
| `soc-agent-client/src/index.ts` | 强制 Node 核心 | 注册 `soc-action-approval`；导出 `./client` 契约；不导入可选 UI |
| `soc-agent-client/src/client/contract.ts` | 核心浏览器契约 | `SocClientRuntime`、`socClient`、`socSurface`、`SOC_CONFIG_CHANNEL`、`soc.admin.content` |
| `soc-agent-client/src/client/core/` | 强制浏览器 UI | `AuthGate`、核心 `/admin` root 与安全回退 |
| `soc-agent-sidebar/src/client/` | 隔离侧栏 | 标准 sidebar owner、子槽位、固定布局/样式 |
| `soc-agent-workspace/src/client/` | 隔离工作区 | 浏览器/选择器、搜索/分组/重排/操作、可恢复 folders 守卫 |
| `soc-agent-brand/src/client/` | 可选品牌 | 侧栏与 conversation hero 品牌贡献 |
| `soc-agent-admin/src/client/` | 可选管理 | 通过 `soc.admin.content` 子槽位挂载完整 `/admin` |
| `soc-agent-action-policy/src/client/` | 可选动作策略 | Full access / SOC mode 菜单与失败关闭 RPC 助手 |
| `soc-agent-attachments/src/client/` | 可选附件 | MarkItDown provider、双 worker 控制器、rail、command、设置卡/schema |
| `soc-agent-email-draft/src/client/` | 可选邮件草稿 | 可编辑草稿/转发 tool view、签名与发送助手 |
| 每个包的 `tsdown.config.ts` / `tsconfig.json` / `lib/` | 构建/TS 配置 | 跟踪 host/browser 产物；setup 注册全部 37 个包并健康检查 26 个浏览器 face |

## 技能、补丁、文档

| 文件 | 用途 |
|---|---|
| `skills/detection-engineering/SKILL.md` | 只读检测设计流程。**陈旧：** 引用已删除的编译/校验/回测工具 |
| `skills/false-positive-analysis/SKILL.md` | 告警解释/分类。部分陈旧（`splunk_search` 已删） |
| `skills/splunk-investigation/SKILL.md` | 基于 `mcp__splunk_mcp__*` 的调查 — 仍有效 |
| `skills/spl-writing/SKILL.md` | CITIC SPL 编写。**陈旧：** 编译器已删除 |
| `tooling/verify-upstream.mjs` | 与新鲜 rc.2 archive 比对纯净 vendor；通过显式可复现规则排除生成构建产物 |
| `docs/GLM_5_3_REPOSITORY_DOCUMENTATION_INSTRUCTIONS.md` | 本文档集的执行简报（勿覆盖） |
| `docs/SHORTENING_PLAN_IMPLEMENTATION.md` | 维护者的重构实施与验证报告（基线 `d264ca7`） |
| `docs/zh/**`、`docs/site/zh/**` | 本文档集与站点的中文版（与本页同轮核对） |
