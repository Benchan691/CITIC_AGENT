# 术语表（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../../reference/GLOSSARY.md)

中文文档与英文版共用同一词汇。工具名、路径、环境变量保持英文原文；概念性术语以中文为准。

## 产品与人

| 术语 | 含义 |
|---|---|
| **SOC** | Security Operations Centre，安全运营中心。 |
| **SOC Agent / "Sentinel"** | 本产品：基于浏览器的调查助手。"Sentinel" 是助手人格（`citic-soc` 预设）。 |
| **分析师 / SOC 用户** | 以本人 Zimbra 身份认证的人；可使用聊天、工具、草稿界面。 |
| **管理员** | 以静态管理凭据（`SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD`）认证的人；经 `/admin` 管理。独立 Cookie（`soc_admin_session`），区别于分析师会话（`soc_session`）。 |
| **客户** | 其安全数据可能出现在证据中的外部组织。客户数据绝不跨客户边界（`AGENTS.md`）。 |

## 接口与传输

| 术语 | 含义 |
|---|---|
| **MCP** | Model Context Protocol — harness 连接工具服务器的标准。此处用两种传输：`stdio`（本地子进程）与 `streamable-http`（HTTP 端点）。 |
| **`soc_agent`** | 本地 Python MCP 服务器（包 `soc-agent-mcp`，脚本 `unified-mcp-server`），精确暴露 28 个 Zimbra + 订阅工具。 |
| **`splunk_mcp`** | 桥接注册外部官方 Splunk MCP 服务器读工具所用的 MCP *命名空间*。不是本仓库的软件 — 桥接是客户端。 |
| **原始工具名** | 工具在其服务器内的名字，如 `splunk_run_query`。 |
| **全限定工具名** | `mcp__<server>__<raw-tool>`，如 `mcp__splunk_mcp__splunk_run_query`。同一词可出现在两段；不代表两个服务器。 |
| **`ui__` 目录条目** | `TOOL_CATALOG` 中的 UI 确认条目（仅 `ui__soc_agent__send_email`）。不是 MCP 工具；模型不可调用。 |
| **`skill` 工具** | 无前缀的宿主技能加载工具（harness `tool-skill` 插件）。 |
| **桥接** | `apps/soc-agent/splunk-bridge.js` — 到外部官方 Splunk MCP 端点的客户端连接。 |
| **控制通道** | Node 宿主用于认证操作（登录/登出/发送/签名列表）的常驻 Python 子进程（`unified_mcp_server.control_server`），stdio JSON 行。 |
| **管理 CLI** | `unified_mcp_server.admin_cli`，每个管理操作一次性拉起（状态、连通测试、附件转换、migrate）。 |
| **Cordis** | vendored 插件框架（`vendor/cordis` + `vendor/loader`）：插件是带 `apply(ctx)` 的对象，依赖经 `inject`，服务经 `ctx.provide`。 |
| **插件 id / 插件包名 / 服务器命名空间** | 三层标识。例：`splunk-official-mcp` → `dsh-soc-agent/splunk-bridge` → `splunk_mcp`。 |

## 策略与安全

| 术语 | 含义 |
|---|---|
| **允许列表（allowlist）** | harness 可注册/执行的工具名的精确集合：每服务器的原始 `allowedToolNames`（补丁），加宿主的 `DOMAIN_TOOLS ∪ CONTROL_TOOLS`。 |
| **动作目录（action catalog）** | `policy.js ACTION_CATALOG` — 12 个面向用户的变更动作。 |
| **动作模式** | `Full access`（每个被允许工具直接执行）或 `SOC mode`（遵循每工具 ask/auto-run/disabled）。部署默认在设置 `soc-action-approval`；会话覆盖在内存。 |
| **动作状态** | 每工具: `ask`（需审批）、`auto`（执行）、`disabled`（拒绝）。 |
| **审批** | harness 审批流（`policy: ask`，失败关闭）：状态为 `ask` 的调用只在用户于界面批准后执行。 |
| **UI 确认** | 在草稿界面额外要求显式确认（`window.confirm('Send this email now?')`）才走 `send-email` RPC 的投递。 |
| **只读默认** | 调查绝不变更系统；每个变更都在 `ACTION_CATALOG` 中并被门控。 |
| **投影** | `investigation.js` 对官方 Splunk 输出的后处理：PII 掩码 + 50 KB 截断。 |
| **背景注入** | `host.js` 每 N 个持久用户提示重新注入 `BACKGROUND.md` 上下文。 |

## Splunk 域

| 术语 | 含义 |
|---|---|
| **SPL** | Splunk Processing Language，搜索语言。 |
| **CITIC SPL / 包装器** | 生产检测格式（元数据头、固定 `table` 顺序、动态 `outputcsv` 子搜索）。此前由 `splunk_compile_citic_detection`（已删除）生成；见技能漂移注记。 |
| **回测 SPL** | 派生的、无 `outputcsv` 的有界变体，用于安全验证。 |
| **`outputcsv`** | 把搜索结果写入 lookup 文件的 Splunk 命令。本系统中它只存在于经评审的生产定义内；应用从不执行。 |
| **`Ruleset.csv`** | `BACKGROUND.md` 与检测技能引用的检测规则目录 lookup；只读证据。 |
| **已触发告警（fired alert）** | 告警实际触发的一个实例。 |
| **检测（detection）** | 已保存的 Splunk 告警定义。本应用从不创建/更新/启用/禁用检测；部署是外部人工流程。 |

## 数据与状态

| 术语 | 含义 |
|---|---|
| **应用会话** | `soc_app_sessions` 中的一行：以加密 Zimbra 令牌认证的登录，24 h TTL。Cookie: `soc_session`。 |
| **归属声明** | `soc_workspace_owners`/`soc_session_owners`/`soc_folder_owners` 中把 harness 对象绑定到用户的行；由受限 API 代理强制。 |
| **受限 API 代理** | `ownership.js createScopedApiProxy` — 过滤列表并拒绝跨用户变更的 9 个 API 域。 |
| **工作区** | `MCP_SERVER_ROOT/.data/soc-workspaces/<userId>/` 下的按用户目录。"General" 自动创建且受保护。 |
| **设置命名空间** | `app_config` 中的持久键值组（如 `soc-action-approval`、`soc-background`、`soc-agent-markitdown-attachments`、`time-context`、`llm-pi-ai`）。 |
| **证据存储** | *本轮已移除* — 属于已删除 Splunk 搜索实现的 SQLite 存储（`SOC_EVIDENCE_STORE`）；磁盘可能残留旧文件。 |
| **MarkItDown** | 用于附件的文档→Markdown 转换库（全内存、有界）。 |
| **工具清单（tool inventory）** | `apps/soc-agent/tool-inventory.js` — 每个工具名的单一运行时无关事实源；策略集与桥接允许列表由其派生。 |
| **Schema 迁移** | `unified_mcp_server/migrations/*.sql` 的版本化 SQL，由 `schema.py` 在 PostgreSQL advisory 锁下应用，台账为 `soc_schema_migrations`；Node 层无 DDL。 |
| **转发草稿（forward draft）** | `zimbra_forward_email` 从既有消息生成的本地可编辑草稿（`forward_message_id` + `forwarded_message` 元数据）。投递只经确认后的发送路径。 |
| **指纹（fingerprint）** | 三处用于漂移/并发的哈希：setup 构建指纹、Zimbra 过滤器集 SHA-256（`expected_fingerprint`）、附件转换缓存键。 |

## 运行状态词汇（全文档统一）

**活跃** · **条件性** · **仅管理员** · **已移除**（删除；旧称"保留"）· **仅测试** · **生成** · **遗留** · **运维工具** · **未知**。
