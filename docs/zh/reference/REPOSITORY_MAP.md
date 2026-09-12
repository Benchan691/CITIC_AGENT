# 仓库地图与普查（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12（第二轮；上一轮基线 `b26d55d`）。
> 语言 / Language: **中文** · [English](../../reference/REPOSITORY_MAP.md)

**本页读者:** 需要知道每个被跟踪路径*是什么*的开发者与评审者 — 权威源码、测试、生成产物、vendor、集成工件或未分类遗留。

**读完后你将了解:** 每个被跟踪的第一方路径的完整分类，以及磁盘上存在但未被跟踪的本地目录。

**方法:** 在核对提交上运行 `git ls-files`（Git 感知发现；`.gitignore` 排除 `node_modules/`、`__pycache__/`、`*.egg-info/`、`.data/`、`.state/`、`.env`）。本提交总计: **182 个被跟踪第一方文件** — `apps/soc-agent` **71**（宿主侧 17 + 服务器侧 54）、`packages/soc-agent-client` **38**、`skills` **4**、`patches` **1**、根目录 **8**（`hi.txt` 已删除）、`docs/` **60**（文档集，含 `SHORTENING_PLAN_IMPLEMENTATION.md`）— 外加 6,970+ 个 `vendor/deepseek-harness` 跟踪文件（按组覆盖）。

**较上一轮（`b26d55d`）的变更:** 已退役的 Python Splunk 栈（34 文件 `splunk/` 包、`splunk_service.py`、`detection.py`、12 个相关测试文件）被**删除**；新增 `tool-inventory.js`（单一工具事实源）、`python-command.js`（共享 Python 拉起助手）、`migrations/*.sql` + `schema.py`（版本化 SQL 迁移）、`tests/python-command.test.js`、`tests/setup.test.js`、`tests/admin-console.test.ts`；客户端遗留状态卡（`SplunkSettings.ts`、`SubscriptionServerSettings.ts`）移除；`hi.txt` 移除。维护者的实施报告是 `docs/SHORTENING_PLAN_IMPLEMENTATION.md`（基线 `d264ca7`）。

相关: [COMPONENT_CATALOG.md](COMPONENT_CATALOG.md)（每组*做什么*）、[SOURCE_INDEX.md](SOURCE_INDEX.md)（逐文件用途与符号）。

---

## 1. 根目录

| 路径 | 分类 | 用途 | 运行状态 |
|---|---|---|---|
| `AGENTS.md` | 文档/治理 | 智能体的强制运行政策（身份、隔离、证据、邮件、Splunk 规则）。经 `citic-soc` 预设（`instructionFileCandidates`）在会话开始加载。 | 活跃（模型上下文） |
| `README.md` | 文档/治理 | 人工概览：布局、安装、更新、官方 Splunk MCP 要求、访问模式；链接实施报告。 | 文档 |
| `BACKGROUND.md` | 文档/治理 | Splunk 参考背景（来自只读 `Ruleset.csv` 审查的规则命名约定；含一个保留的客户命名示例）。由 `host.js` `installBackgroundRefresh` 作为背景上下文注入。 | 活跃（模型上下文） |
| `setup.sh` | 安装/管理脚本 | "SOC Agent setup doctor"：bootstrap 克隆、`--check`、`--plugins` 模式；单一参数清单驱动提示/检查；**官方 Splunk MCP 端点 + 令牌必填**（REST Splunk 字段已移除）。 | 活跃（运维执行） |
| `update.sh` | 安装/管理脚本 | 拒绝参数与脏树，`git pull --ff-only`，再跑 `setup.sh --plugins`。 | 活跃（运维执行） |
| `requirements.txt` | 配置/部署装配 | 恰好两个外部 pnpm 插件 spec；与 `setup.sh` 的 `PLUGIN_NAMES` 做数量校验。 | 活跃（安装输入） |
| `lefthook.yml` | 配置（无效） | 全部为注释示例；无活跃 Git 钩子。 | 未启用 |
| `.gitignore` | 配置 | 忽略 `node_modules/`、`__pycache__/`、`*.egg-info/`、`/.data/`、`**/.state/` 等。注意 `packages/soc-agent-client/lib/` **不在**忽略列表（被跟踪的生成产物）。 | 活跃 |
| `docs/` | 文档 | 本文档集、执行简报、维护者实施报告。 | 文档 |

*（上一轮遗留已解决：`hi.txt` 在本区间被删除 — 审计的维护者问题关闭。）*

## 2. `apps/soc-agent/` — SOC 应用宿主（Node，17 个文件）

| 路径 | 分类 | 用途 |
|---|---|---|
| `package.json` | 清单 | 插件 bundle `dsh-soc-agent`；导出 `./host`、`./splunk-bridge`、`./auth-host`、`./ownership`、`./policy`、`./python-command`、`./tool-inventory`；`dsh.bundle.patch: ./cordis.patch.yml`。 |
| `cordis.patch.yml` | 配置/部署装配 | 产品补丁：启用/禁用上游插件、注册 `soc_agent`（stdio，**28** 个原始允许名）与 `splunk-official-mcp`（桥接）、把 `skill-filesystem` 指向 `skills/`。 |
| `tool-inventory.js` | 权威源码 | **单一运行时无关事实源**：`OFFICIAL_SPLUNK_TOOL_NAMES`（13 个原始名）、`TOOL_CATALOG`（26 条：13 个 Zimbra 读含 `zimbra_forward_email`、12 个变更、1 个 UI 确认）、`SUBSCRIPTION_READ_TOOLS`（3）。被 `policy.js` 与 `splunk-bridge.js` 共同导入。头注释："Draft preparation never delivers mail." |
| `policy.js` | 权威源码 | 从清单派生全部策略集：`OFFICIAL_SPLUNK_READ_TOOLS`（13 限定名）、`ZIMBRA_READ_TOOLS`（13）、`READ_ONLY_TOOLS`（**30**）、`ACTION_CATALOG`（**12**）、`ACTION_TOOLS`、`TOOL_CATALOG`（再导出，26）、`MANAGED_TOOL_NAMES`（25）、`DOMAIN_TOOLS`（**42**）、`APPROVAL_TOOLS`。 |
| `host.js` | 权威源码 | 插件 `soc-agent-host`：`/soc-agent-config` RPC、`tools/pre-execute` 策略门、动作模式、背景刷新、管理页。`runAdmin` 委托 `runPythonCommand`；`test-splunk` 调 `testOfficialSplunkConnection`（实时桥接探测）。 |
| `auth-host.js` | 权威源码 | 插件 `soc-agent-auth-host`：构造 `SocAuthService`、`mcp/request-meta` 元数据、传输圈栏、特权请求授权。 |
| `ownership.js` | 权威源码 | 认证/归属边界：登录路由、受限 API 代理、Postgres `SocStateStore`、到 Python 的控制通道。`ensureSchema` 不再含 DDL — 它调用 `unified_mcp_server.schema migrate` 并经 stdin 传入 URI。 |
| `python-command.js` | 权威源码 | 共享一次性 Python 运行器：`pythonEnvironment()`（剔除 `SOC_ADMIN_*`；`MCP_SERVER_ROOT`/`MCP_SEVER_ROOT` 回退）、`runPythonCommand({module, command, arg, payload, timeoutMs, signal, mapError})`。注释："One-shot helpers only." |
| `splunk-bridge.js` | 权威源码 | 插件 `soc-agent-splunk-official-bridge`：从 `tool-inventory.js` 导入清单；校验 `SPLUNK_MCP_ENDPOINT`（HTTP(S)、无内嵌凭据/查询/片段；明文 HTTP 需 `SPLUNK_ALLOW_INSECURE_HTTP=true`）；`testOfficialSplunkConnection` 经桥接真实执行 `splunk_get_info`（185 秒预算，错误中脱敏 Bearer 令牌）。 |
| `investigation.js` | 权威源码 | `tools/post-execute` 投影：仅对 `mcp__splunk_mcp__splunk_*` 输出做掩码（卡号/SSN）与 50 KB 截断。 |
| `tests/*.test.js`（11 文件，35 测试） | 第一方测试 | 新: `python-command.test.js`（1）、`setup.test.js`（5）。增长: `splunk-bridge.test.js`（4）。见 [TEST_COVERAGE_MATRIX.md](TEST_COVERAGE_MATRIX.md)。 |

## 3. `apps/soc-agent/server/` — Python MCP 服务器（包 `soc-agent-mcp`，54 个文件）

| 路径 | 分类 | 用途 |
|---|---|---|
| `pyproject.toml`、`uv.lock` | 清单/锁文件 | "SOC Agent MCP server for Zimbra and subscriptions"，Python ≥3.12，入口 `unified-mcp-server`；`migrations/*.sql` 作为 package-data；构建中已无 `splunk.*` 包。 |
| `.env.example`、`.gitignore`、`README.md` | 配置模板/文档 | 模板只列**活跃**变量；README 声明：不注册 Splunk 工具、管理检查经桥接探测 `splunk_get_info`、退役的 Python Splunk API 不再随附。 |
| `unified_mcp_server/server.py` | 权威源码，活跃入口 | FastMCP 构造、`Runtime`（`zimbra: ZimbraMailService`）、`execute()` 信封、身份解析、从三个模块注册 **28 个工具**（mail 含 `zimbra_forward_email`）；使用 `zimbra.core.service` 的 `_EmptyAccountStore`。 |
| `config.py` | 权威源码 | `ServerSettings` + 精简 `SplunkSettings`（**仅** `mcp_endpoint`、`token`、`verify_ssl`、`allow_insecure_http`、`sanitize_output`）+ `ZimbraSettings` + `MarkItDownSettings` + `EmailServerSettings`；env-only；`public_status()` 报告 `official_mcp_enabled`。 |
| `schema.py` | 权威源码 | **版本化 SQL 迁移运行器**：`apply_migrations(connection)` 取 `pg_advisory_xact_lock`，在 `soc_schema_migrations` 记录已应用文件，按序执行待应用的 `migrations/*.sql`（package data）。独立 `main()` 从 **stdin** 读 `{"uri": …}`（刻意不读 `.env`），超时 15000ms，输出 `{"migrated": true}` 或 `schema_migration_failed`。 |
| `migrations/001_initial.sql` | Schema 定义 | `IF NOT EXISTS` 创建 `app_config`、`zimbra_accounts`、`soc_users`、`soc_app_sessions`（+索引）、`soc_session_revocations`、`soc_workspace_owners`、`soc_session_owners`（+索引）、`soc_folder_owners`、`soc_bootstrap`。 |
| `migrations/002_remove_catalog.sql` | Schema 清理 | 标记门控（`catalog-feature-removed-v1`）删除八张遗留目录表。 |
| `auth.py`、`request_context.py` | 权威源码 | `ZimbraIdentity`、`identity_for_session`；`OperationContext`、180 秒 `operation_budget`。 |
| `postgres_store.py` | 权威源码 | 启动时调用 `apply_migrations`（事务内、advisory 锁），随后读写各表；Fernet 加密配置；遗留迁移 API 保持惰性。 |
| `account_store.py` | 权威源码（遗留路径） | 加密本地 JSON 账户存储（仅管理/兼容）。 |
| `errors.py`、`responses.py` | 权威源码 | `ServiceError` 分类；`success`/`failure` 信封。 |
| `blocking_io.py` | 权威源码 | 有界线程卸载：全局信号量 8、每主体 2、shielded 任务。 |
| `env_loader.py` | 权威源码 | 加载 `server/.env` 再工作区 `.env`（覆盖）；从 Python 进程剔除 `SOC_ADMIN_*`。 |
| `zimbra_service.py` + `zimbra/`（11 文件） | 权威源码 | SOAP 客户端（`zimbra.py`，含 `zimbra_forward_message` — 供发送路径转发原信与附件）、身份绑定核心（`core/service.py`，现含 `_EmptyAccountStore`）、mail 服务/工具（**13 个工具**，含 `create_forward_draft`）、filter 服务/工具（9 个工具，指纹并发）。 |
| `email/`（3 文件） | 权威源码 | `EmailSubscriptionService`（外部 REST）+ 6 个订阅工具。 |
| `attachment_converter.py` | 权威源码 | MarkItDown 转换：限额、归档安全、内存 LRU 缓存。 |
| `control_server.py` | 权威源码 | 常驻私有控制通道（stdio JSON 行），分发 `auth_cli` 命令。 |
| `admin_cli.py` | 权威源码（运维工具） | 一次性管理命令：`get-settings`、`test-subscription-server`、`convert-attachment`、`migrate`（现执行 `migrate(store)` — 应用 Schema）。**`test-splunk` 已移除**。拒绝设置写入与邮件操作。 |
| `auth_cli.py` | 权威源码 | 一次性认证命令：`login`、`logout`、`send-email`（现转发 `forward_message_id`）、`list-signatures`；也是控制通道的分发表。 |
| `tests/`（10 测试文件 + `__init__.py`，39 测试） | 第一方测试 | 全部留存 Splunk 测试文件删除；新增 `test_schema.py`（3）。见 [TEST_COVERAGE_MATRIX.md](TEST_COVERAGE_MATRIX.md)。 |

**本区间移除（原"保留"）：** `unified_mcp_server/splunk/**`（34 文件）、`splunk_service.py`、`detection.py`、以及 `test_citic_compiler.py`、`test_citic_format.py`、`test_official_splunk_mcp_client.py`、`test_search_evidence.py`、`test_security_queue.py`、`test_splunk_*.py`（6）、`citic_fixtures.py`。磁盘上可能残留未跟踪目录（`splunk/`、`catalog/`、`__pycache__/`）— 它们**未被跟踪**也不在构建中（`pyproject.toml` 已不打包）。

## 4. `packages/soc-agent-client/` — 浏览器/管理 UI（38 个文件）

| 路径 | 分类 | 用途 |
|---|---|---|
| `package.json` | 清单 | `dsh-soc-agent-client` 0.1.0；入口 `lib/index.js`，浏览器入口 `lib/client.js`；`dsh.client` 声明。 |
| `tsdown.config.ts`、`tsconfig.json` | 构建配置 | `clientBundle('dsh-soc-agent-client', ['src/index.ts'])`（harness 共享预设）。 |
| `src/index.ts` | 权威源码 | Node 半：注册持久设置命名空间 `soc-agent-markitdown-attachments`、`soc-action-approval`。 |
| `src/action-approval-settings.ts` 等 | 权威源码 | 共享 schema/类型（无 I/O）：动作模式/状态；附件限额（默认 5 文件 / 10 MB / 50 MB / 200 k / 500 k 字符）。 |
| `src/client/index.ts` | 权威源码 | 浏览器挂载：`/admin` 分支（仅 AdminConsole）vs 主应用（AuthGate 遮罩、SocActionPolicyMenu、附件控制器、草稿 toolview、CiticBrand）；`api.folders = undefined`。遗留卡导出已移除。 |
| `src/client/AdminConsole.tsx`（+css） | 权威源码 | 独立管理控制台：Connections（Splunk 检查 = **实时桥接探测**）、Agent context、Access & approvals、AI providers（只写凭据）；新增 `useStatus`/`StatusNotice`（`role=alert`/`status` + 重试）。 |
| `src/client/AuthGate.tsx`（+css） | 权威源码 | 全屏 Sentinel 登录遮罩；轮询 `/auth/me`。 |
| `src/client/EmailDraftToolview.tsx`、`emailDraft.ts`（+css） | 权威源码 | 工具块内草稿编辑 UI — 现同时键于**转发工具**；`emailDraft.ts` 新增 `ZIMBRA_FORWARD_DRAFT_TOOL_NAME`、`forward_message_id`、`forwarded_message` 元数据；`window.confirm` 门；`send-email` RPC；状态机。 |
| `src/client/SocActionPolicyMenu.tsx`（+css） | 权威源码 | 会话级 Full access / SOC mode 切换。 |
| `src/client/SocActionApprovalSettings.tsx`（+css） | 权威源码 | 管理清单的净化器（`validCatalog`）。 |
| `src/client/markitdownAttachments.ts` 等 | 权威源码 | 附件选择/限额 UI；`convert-attachment` RPC（双 worker + 缓存）。 |
| `src/client/ZimbraSettings.ts`、`settings-common.ts`、`SplunkZimbraOverlay.module.css` | 权威源码 | 保留的共享设置助手（已精简）；静态 Zimbra 卡。 |
| `src/client/CiticBrand.tsx`（+css） | 权威源码 | 品牌标志（"Sentinel"）。 |
| `src/client/actionPolicy.ts` | 权威源码 | `readActionMode` RPC 助手（畸形响应失败关闭）。 |
| `lib/*` | **被跟踪的生成产物** | tsdown bundle（本轮重建：−441 行）；闭包工厂工件。 |
| `tests/*.test.ts`（5 文件，12 测试） | 第一方测试 | 新: `admin-console.test.ts`（1）；`email-draft-toolview.test.ts` 增至 3（转发字段）。 |

**本区间移除：** `src/client/SplunkSettings.ts`、`src/client/SubscriptionServerSettings.ts` 及其在 `client/index.ts` 的导出。

## 5. `skills/`

| 路径 | 分类 | 用途 |
|---|---|---|
| `detection-engineering/SKILL.md` | 文档（运行时技能） | 只读检测设计/验证/回测工作流。**本轮陈旧：** 引用已被删除的 `splunk_get_detection` 等工具。 |
| `false-positive-analysis/SKILL.md` | 文档（运行时技能） | 告警解释/分类与调参建议。引用的 `splunk_search`/`splunk_validate_query` 已删除。 |
| `splunk-investigation/SKILL.md` | 文档（运行时技能） | 基于 `mcp__splunk_mcp__*` 只读工具的调查 — 仍然有效。 |
| `spl-writing/SKILL.md` | 文档（运行时技能） | CITIC 生产 SPL 编译 — **陈旧**（编译器已删除）。 |

漂移注：`AGENTS.md` 仍列七个技能；磁盘四个；其中两个引用已移除的工具。记录于 [DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md)。

## 6. `patches/`

| 路径 | 分类 | 用途 |
|---|---|---|
| `dsh-auto-collapse@0.1.4.patch` | 本地补丁的 vendor 行为 | pnpm 补丁：英文本地化、英文时长解析、`[data-dshcf-preserve]` 行豁免自动折叠（SOC 草稿卡使用）。 |

## 7. `vendor/deepseek-harness/` — vendored 上游（按组）

集成面不变，本轮一处新增：`packages/host/apiproxy` 的 `rpc.schema.ts`/`rpc.ts` 声明结构化 `authentication-required`/`admin-authentication-required` 错误码（含测试）— SOC RPC 认证契约被钉入上游。其余面照旧：MCP 客户端桥、cordis loader、base/web 补丁层、工具+审批注册表、技能、预设（含本地 `citic-soc`）、webserver/gateway/static、浏览器引导。

## 8. 磁盘上的本地（未跟踪）路径

| 路径 | 分类 | 说明 |
|---|---|---|
| `apps/soc-agent/server/unified_mcp_server/splunk/`、`catalog/`、`__pycache__/` | 未跟踪残留 | 本轮从 Git 删除；陈旧目录可保留在磁盘直至清理。未打包、按配置不可导入。 |
| `benchmarks/`（如存在）、`packages/soc-agent-scheduler/node_modules/` | 运行/本地状态 | 无跟踪内容；无角色。 |
| `**/node_modules/`、`.venv/` | 依赖目录 | 忽略。 |
| `apps/soc-agent/server/.env` | 运行/本地机密 | 忽略；本文档从不读取或发布其内容。 |
| `~/.dsh/`（仓库外） | 运行状态 | profile 装配与 harness 状态；原 SQLite 证据存储默认位置已无代码归属。 |
| `<root>/.data/` | 运行状态 | `soc-workspaces/<userId>/…`、setup 指纹。忽略。 |

## 9. 值得点名的普查决策

- `packages/soc-agent-client/lib/` 仍是**唯一被跟踪的生成产物**；本轮已重建（−441 行）。
- **Splunk 栈已移除** — 上一轮"代码存在不等于运行时暴露"的例子现在变成"彻底移除"（[DOCUMENTATION_AUDIT.md](../DOCUMENTATION_AUDIT.md) §6）。
- `tool-inventory.js` 是新的结构性漂移栅栏：策略、桥接与（经测试的）Python 注册都源自/钉住同一清单。
- `hi.txt` 已删除；上一轮审计问题关闭。
- 数据库 Schema 创建单一来源化为 **Python 迁移**；Node 层无 DDL。
