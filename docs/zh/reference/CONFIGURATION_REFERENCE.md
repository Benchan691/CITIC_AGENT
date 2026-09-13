# 配置参考（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../../reference/CONFIGURATION_REFERENCE.md)。
> 来源: `apps/soc-agent/server/.env.example`、`unified_mcp_server/config.py`（`ServerSettings.from_env`）、`env_loader.py`、`schema.py`、`postgres_store.py`、`apps/soc-agent/splunk-bridge.js`、`ownership.js`、`host.js`、`cordis.patch.yml`、`setup.sh`。

**本页读者:** 准备部署的运维、追踪取值来源的开发者。

**通俗概述。** 配置归部署所有: Python 服务器只读进程环境变量（由根 `.env` 与 `server/.env` 播种），Node 宿主读自己的变量加服务器文件。优先级（代码所证）: **进程环境最高**，其次 `server/.env`；`env_loader.py` 再加载根 `.env`（带覆盖）。纯净 vendor 不接收运行时 `.env`。绝不在文档/工单/shell 历史中出现真实机密值。

---

## 1. 加载与优先级（按代码）

1. 进程环境（最高）。
2. `apps/soc-agent/server/.env`（`env_loader.load_server_env`），随后根 `.env`（**带覆盖**）。
3. `.env.example` — 仅模板，从不加载。
4. `setup.sh` 写根 `.env` 与 `server/.env`（chmod 600）；不写入纯净的 `vendor/deepseek-harness`。
5. `env_loader.py` 从 Python 进程剔除 `SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD`（`_NODE_ONLY_ENV_NAMES`）；`python-command.js` 的 `pythonEnvironment()` 与 `host.js` 同样在拉起子进程前删除两者。

按代码的回退链:
- 存储 URI: `APP_POSTGRES_URI` → `LANGGRAPH_POSTGRES_URI` → `POSTGRES_URI`。
- 服务器根: `DSH_SOC_AGENT_SERVER` → `<bundle>/server`；工作区根: `MCP_SERVER_ROOT` → 遗留拼写 `MCP_SEVER_ROOT`。
- 桥接配置: `process.env` → `server/.env`（`splunk-bridge.js deploymentValues`）。

**Schema 迁移不走环境:** 宿主 `ensureSchema`（与管理 `migrate` RPC）调用 `uv run python -m unified_mcp_server.schema migrate`，把解析出的 PostgreSQL URI **以 JSON 经 stdin** 传入 — 刻意为之，因为在该子进程加载 `.env` "可能覆盖目标并初始化另一个数据库"（`schema.py`）。

## 2. Node 宿主 / 认证变量

| 变量 | 消费者 | 用途 | 何时必填 | 安全示例形状 | 默认/回退 | 敏感 | 校验 |
|---|---|---|---|---|---|---|---|
| `SOC_ADMIN_EMAIL` | `ownership.js resolveAdminCredentials` | `/admin` 登录的静态管理员身份 | 总是（缺失启动即抛） | `soc-admin@example.test` | — | 凭据相邻 | 非空；小写；`timingSafeEqual`；从子环境剔除 |
| `SOC_ADMIN_PASSWORD` | `ownership.js` | 静态管理员机密 | 总是 | *（长随机值）* | — | **机密** | 非空；不回显；内存中 SHA-256 哈希 |
| `APP_POSTGRES_URI` | `SocStateStore`、`PostgresStore`、补丁 env | 应用存储 | 登录/归属必需 | `postgresql://user:***@db.example.test:5432/soc` | 回退 `LANGGRAPH_POSTGRES_URI`、`POSTGRES_URI` | **机密** | setup 正则 + `psql` 探测 |
| `APP_SETTINGS_ENCRYPTION_KEY` | `postgres_store.py` | `app_config` 与存储令牌的 Fernet 密钥 | Postgres 启用时必需 | 32 字节 hex 或 urlsafe Fernet key | 非法时 SHA-256 派生 | **机密** | 缺失即报错；解密失败带修复指引 |
| `APP_POSTGRES_POOL` | `postgres_store.py` | 启用 psycopg 连接池 | 可选 | `true` | `true` | — | 布尔 |
| `SOC_CONTROL_CHANNEL` | `ownership.js` | `auto`（常驻控制进程）vs `off`（一次性拉起） | 可选 | `auto` | `auto` | — | 枚举 |
| `SOC_AUTH_COMMAND_TIMEOUT_MS` | `ownership.js`、`host.js` | 认证/管理子进程超时 | 可选 | `185000` | `185000` | — | 整数 |
| `DSH_SOC_AGENT_SERVER` | `host.js`、`ownership.js`、`python-command.js` | 覆盖 Python 服务器根 | 可选 | `/opt/CITIC_AGENT/apps/soc-agent/server` | `<bundle>/server` | — | 路径 |
| `MCP_SERVER_ROOT` | 补丁 env、`python-command.js` | 工作区根（`.data/`、`skills/` 锚点） | 补丁设置 | 仓库根 | `MCP_SEVER_ROOT` 回退 | — | 路径 |

## 3. Splunk — 官方 MCP 桥接变量（唯一保留的 Splunk 配置）

setup 与 `./setup.sh --check` **要求**此连接。`SplunkSettings` 现在只有这五个字段。

| 变量 | 消费者 | 用途 | 何时必填 | 安全示例形状 | 默认 | 敏感 | 校验 |
|---|---|---|---|---|---|---|---|
| `SPLUNK_MCP_ENDPOINT` | `splunk-bridge.js`、`config.py` | 外部官方 Splunk MCP 服务器 URL（streamable HTTP） | 总是（缺之 setup/检查失败） | `https://splunk-mcp.example.test/mcp` | 缺失 → 桥接禁用 + setup 失败 | 端点 | 仅 HTTP(S)；**无内嵌凭据/查询/片段**（`splunk-bridge.js` URL 校验） |
| `SPLUNK_TOKEN` | 同上 | 桥接的 Bearer 令牌 | 与端点配套 | *（服务令牌）* | — | **机密** | 非空；以 `Authorization: Bearer` 发送；连接测试错误中脱敏 |
| `SPLUNK_VERIFY_SSL` | 同上 | TLS 校验 | 可选 | `true` | `true` | — | 布尔；证书例外仅适用于此 Splunk 连接 |
| `SPLUNK_ALLOW_INSECURE_HTTP` | 同上 | 明文 HTTP 端点的显式选择 | 仅 `http://` 端点 | `false` | `false` | — | `http:` URL 必须为 `true`（桥接否则拒绝） |
| `SPLUNK_SANITIZE_OUTPUT` | `investigation.js`、`config.py` | 关闭卡号/SSN 输出掩码 | 可选 | `true` | `true`（`0/false/no/off` 关闭） | — | 布尔式正则 |

## 4. 已退役的 Splunk 配置（本轮移除）

全部遗留 Splunk REST 变量（`SPLUNK_HOST`、`SPLUNK_HOST_FOR_DOCKER`、`RUNNING_INSIDE_DOCKER`、`SPLUNK_PORT`、`SPLUNK_SCHEME`、`SPLUNK_URL`、`SPLUNK_USERNAME`、`SPLUNK_PASSWORD`）、全部 `SPLUNK_POLICY_*`、`SPLUNK_SEARCH_*`、`SPLUNK_LOOKUP_*`、`SPLUNK_DETECTION_*`、`SPLUNK_JOB_TIMEOUT`、`SPLUNK_REQUEST_TIMEOUT`、`SPLUNK_MAX_EVENTS`、`SPLUNK_RISK_TOLERANCE`、`SPLUNK_SAFE_TIMERANGE`、`SECURITY_QUEUE_*`、`SOC_EVIDENCE_STORE` 及 `SPL_*` 别名已**从代码库删除**（config.py、`.env.example`、setup.sh）。仅 REST 的部署必须补官方端点与令牌，Splunk 工具才会出现。

## 5. Zimbra 变量

| 变量 | 用途 | 默认 | 备注 |
|---|---|---|---|
| `ZIMBRA_HOST` | SOAP 端点基址 | —（必需） | 除 `ZIMBRA_ALLOW_INSECURE_HTTP` 外强制 https；无凭据/查询/片段/路径 |
| `ZIMBRA_VERIFY_SSL` | TLS 校验 | true | — |
| `ZIMBRA_TIMEOUT` | 请求超时（秒） | 1–600 | — |
| `ZIMBRA_ALLOW_SEND` | 真实邮件投递门 | 代码默认 true；部署决定 | 唯一发送路径是 UI 确认的 RPC |
| `ZIMBRA_ALLOW_MOVE` / `ZIMBRA_ALLOW_FOLDER_WRITE` / `ZIMBRA_ALLOW_SIGNATURE_WRITE` | 变更门 | `true` | 宿主 ask 门之上的 MCP 侧补充 |
| `ZIMBRA_ALLOW_FILTER_WRITE` | 过滤器写门 | `true` | 写还需 `expected_fingerprint` |
| `ZIMBRA_ALLOW_FILTER_REDIRECT` / `ZIMBRA_ALLOW_FILTER_DISCARD` | 危险过滤器语义门 | `true` | 按规则校验 |
| `ZIMBRA_MAX_ATTACHMENT_BYTES` / `ZIMBRA_MAX_ATTACHMENT_TEXT_CHARS` | 附件限额 | 10 MB / 200 000（硬顶 100 MB / 2 000 000） | — |
| `ZIMBRA_ALLOW_INSECURE_HTTP` | 允许明文 HTTP | false | — |

*(本轮移除: `ZIMBRA_ACCOUNTS_FILE`、`ZIMBRA_ACCOUNTS_KEY_FILE`、`ZIMBRA_ACCOUNTS_KEY`、遗留 `ZIMBRA_EMAIL`/`ZIMBRA_PASSWORD`。)*

## 6. 订阅服务、MarkItDown、服务器身份

| 变量 | 用途 | 默认/校验 |
|---|---|---|
| `SUBSCRIPTION_SERVER_URL` | 订阅服务基址 | 与用户+密码共同构成 `configured`；默认 https；无凭据/片段 |
| `SUBSCRIPTION_SERVER_USER` / `SUBSCRIPTION_SERVER_PASSWORD` | 服务登录 | **机密**（密码） |
| `SUBSCRIPTION_SERVER_TIMEOUT` | 秒 | 30（1–600） |
| `MARKITDOWN_LLM_ENABLED` | 启用 LLM/OCR 转换 | false；为 true 时需 `MARKITDOWN_LLM_API_KEY` + `MARKITDOWN_LLM_MODEL` |
| `MARKITDOWN_LLM_API_KEY` / `BASE_URL` / `MODEL` / `TIMEOUT` | LLM 转换配置 | **机密**（API key） |
| `MCP_SERVER_NAME` / `MCP_SERVER_DESCRIPTION` | FastMCP 身份 | 默认 "SOC Agent MCP" 等 |
| `MCP_TRANSPORT`（遗留 `TRANSPORT`） | `stdio` \| `sse` \| `streamable-http`（`http` 映射） | `stdio` |
| `MCP_HOST` / `MCP_PORT`（遗留 `HOST`/`PORT`） | 非 stdio 时的 HTTP 绑定 | `127.0.0.1` / `8050` |
| `LOG_LEVEL` | Python 日志 | INFO |

## 7. 设置命名空间（存于 `app_config`，非环境）

| 命名空间 | Schema | 写入者 | 读取者 |
|---|---|---|---|
| `soc-action-approval` | `{mode: 'soc'\|'full', actionStates: {tool: 'ask'\|'auto'\|'disabled'}}` | 管理控制台 → `settings.mutate` | `host.js savedActionPolicy`（部署默认） |
| `soc-background` | `{enabled: bool, repeatEveryUserPrompts: int ≥0}` | 管理控制台（Agent context） | `host.js installBackgroundRefresh` |
| `soc-agent-markitdown-attachments` | 文件/字节/字符限额（默认 5 / 10 MB / 50 MB / 200 k / 500 k） | 设置卡（`settingsScope`） | `MarkItDownDocumentController` |
| `time-context` | 当前时间注入 | 管理控制台 | harness time-context 插件 |
| `llm-pi-ai` | 自定义提供商（`providers.<route>`）+ 凭据引用 `<ROUTE>_API_KEY` | 管理控制台（AI providers） | harness LLM 提供商注册表 |

会话级动作模式覆盖（`ownership.js setActionMode`）**仅内存** — 登出、撤销、宿主重启即清除，回到部署默认。

## 8. 校验摘要（失败关闭行为）

- 端点校验器拒绝内嵌凭据、查询串、片段与明文 HTTP（除非对应 `*_ALLOW_INSECURE_HTTP`）；错误消息不回显值（`config.py _validate_http_endpoint`；`splunk-bridge.js` URL 校验）。
- 缺失配置以 `not_configured` + `missing_environment_variables`（管理 RPC 最多列 20 个）呈现；携带凭据的端点形状被拒绝（`test_config.py`）。
- 畸形动作策略设置退化为 SOC 默认 — "畸形或不可用的已保存设置绝不能授予动作"（`host.js normalizedActionPolicy`）。
- 状态输出脱敏: 端点仅主机（`redact_endpoint`）、布尔/限额；无密码/令牌/用户名/邮箱身份（`ServerSettings.public_status`，含 `official_mcp_enabled`）。

相关: [CONFIGURATION.md](../CONFIGURATION.md)（叙述）、[DATA_STORE_CATALOG.md](DATA_STORE_CATALOG.md)（设置存于何处）。
