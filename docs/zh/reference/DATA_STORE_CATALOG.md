# 数据存储目录（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../../reference/DATA_STORE_CATALOG.md)。
> 来源: `unified_mcp_server/migrations/*.sql`、`schema.py`（迁移运行器）、`postgres_store.py`、`ownership.js`（`SocStateStore.ensureSchema` → Python 迁移）、`account_store.py`、`host.js`/`ownership.js`（工作区路径）、`.gitignore`。留存 SQLite 证据存储本轮随 Splunk 栈移除。

**本页读者:** 规划备份/保留的运维、触碰状态的开发者、跟踪敏感数据的评审者。

**通俗概述。** 几乎所有持久状态都在 PostgreSQL：用户、应用会话（Zimbra 令牌加密存储）、撤销、归属声明、Fernet 加密键值配置。按用户工作文件在 `.data/soc-workspaces/<userId>/` 下。其余要么瞬时（草稿只存在于工具结果），要么遗留。

---

## 1. PostgreSQL（`APP_POSTGRES_URI` → 回退链）

连接池: Node `pg.Pool` max 10（`SocStateStore`）；Python `psycopg_pool.ConnectionPool` min 1 / max 4、`connect_timeout=5`、`statement_timeout=15000`；`APP_POSTGRES_POOL` 关闭时按调用连接。

**Schema 归属（本轮新增）:** `unified_mcp_server/migrations/*.sql` 的版本化 SQL 迁移，由 `schema.py apply_migrations` 应用 — `pg_advisory_xact_lock(hashtext('soc-agent-schema'))` 序列化启动，`soc_schema_migrations` 记录已应用文件名，待应用文件在调用者事务内按序执行。`001_initial.sql` 创建下表（`IF NOT EXISTS`）；`002_remove_catalog.sql` 按 `catalog-feature-removed-v1` 标记删除八张遗留目录表。Node 的 `SocStateStore.ensureSchema` 现在只是调用 `uv run python -m unified_mcp_server.schema migrate`（stdin 传 URI）；管理 `migrate` RPC 经 `admin_cli` 做同样的事。

| 表 | 所属 | 用途 | 敏感字段 |
|---|---|---|---|
| `soc_users` | 迁移/Python | 每个 Zimbra 邮箱的本地身份 | `zimbra_email`（标识符；低敏感） |
| `soc_app_sessions` | 同上 | 应用会话: id（PK）、用户 FK、**`zimbra_token_encrypted`**、创建/过期时间（24 h TTL）+ 用户/过期索引 | Zimbra 会话令牌，Python 端 Fernet 加密；Node SELECT 刻意省略该列 |
| `soc_session_revocations` | 同上 | 一次性撤销记录（`reason`，如 `new_device_login`；有期限；消费即删） | — |
| `soc_workspace_owners` | 同上 | 工作区 → 属主声明 | 路径（用户域） |
| `soc_session_owners` | 同上 | 会话 → 属主声明（须位于已归属工作区）+ 索引 | — |
| `soc_folder_owners` | 同上 | 文件夹 → 属主（先到先得） | — |
| `soc_bootstrap` | 同上 | 一次性标记（如 `002_remove_catalog.sql` 的 `catalog-feature-removed-v1` 门） | — |
| `soc_schema_migrations` | `schema.py` | 已应用迁移文件名（version PK、`applied_at`） | — |
| `app_config` | 迁移/Python | 加密键值配置（设置命名空间；键见 [CONFIGURATION_REFERENCE.md](CONFIGURATION_REFERENCE.md) §7） | `value_encrypted`（Fernet） |
| `zimbra_accounts` | 迁移/Python | **遗留**邮箱凭据（`password_encrypted`） | 密码（加密）；正常运行不读（`_EmptyAccountStore`） |

`002_remove_catalog.sql` 删除的表: `soc_catalog_staging`、`soc_catalog_import_batches`、`soc_catalog_publications`、`soc_catalog_history`、`soc_fix_source_type`、`soc_rule_catalog`、`soc_customer`、`soc_catalog_migrations`。

## 2. 按用户工作区目录

- **根:** `MCP_SERVER_ROOT/.data/soc-workspaces/<userId>/`（general 工作区 `…/general`）— `ownership.js userWorkspaceRoot`。归属认证用户；创建时校验单目录名（拒绝绝对/`..`/`\`/NUL）、`mkdir` + `realpath` 规范化、`isWithinPath` 包含性（穿越/符号链接逃逸 → `workspace-invalid-path`）。
- **setup 指纹:** `<root>/.data/harness-install.sha256`、`harness-build.sha256`。
- **harness 会话/状态:** `.data/`、`.state/`（gitignored）— 归属代理按用户限定可见性。

## 3. 仓库外的 vendored/运行时位置

| 位置 | 用途 | 备注 |
|---|---|---|
| `$DSH_HOME` 或 `~/.dsh/` | profile 装配: `profiles/web/pnpm-workspace.yaml`、`package.json`（SOC 本地包直接依赖） | 由 setup 矩阵与官方 `pnpm dsh plugin` 添加/移除机制管理；不复制第三方补丁 |
| `$DSH_HOME` 或 `~/.dsh` 的 `soc-evidence.sqlite3` | **本轮起无归属** — SQLite 证据存储属于已删除的 Splunk 搜索实现；磁盘可能残留旧文件 | 可归档/删除；无代码再写入 |
| `apps/soc-agent/server/.env` | 本地机密/配置 | gitignored；文档从不读取 |
| 仓库根 `.env` 与 `apps/soc-agent/server/.env` | 保持在跟踪 vendor 快照之外的运行时机密/配置 | chmod 600；setup 不写 vendor `.env` |

## 4. 被跟踪的生成产物

| 路径 | 生成自 | 消费者 |
|---|---|---|
| `packages/soc-agent-*/lib/index.js` | 各包 `src/index.ts`（tsdown） | 各插件的 Node 半（`main`） |
| `packages/soc-agent-*/lib/client.js` + `.map` | 各包浏览器 `src/client/**`（tsdown 闭包工厂） | 浏览器模块加载器；26 个独立浏览器面通过 `socClient` service 共享核心契约 |

漂移检测: `setup.sh` 检查 26 个 SOC 浏览器面中每个字面 `require()` 是否在允许列表内，违规即重建；`--rebuild` 强制再生成。

## 5. 瞬时状态（刻意不持久化）

| 对象 | 存在位置 | 生命周期 |
|---|---|---|
| `zimbra_send_email` / `zimbra_forward_email` / `zimbra_use_signature_on_email` 的邮件草稿 | 仅工具结果 JSON（界面表单状态） | 直至对话渲染；无存储写入 |
| 会话级动作模式 | `ownership.js actionModes` Map（内存） | 登出/撤销/宿主重启 |
| 管理员会话 | 以 SHA-256 令牌为键的内存 Map | 8 h TTL 或宿主重启 |
| 附件转换缓存 | `AttachmentConverter` LRU（64 项 / 4 MB，内存） | 进程生命周期 |
| 每请求 `Runtime` / 邮件服务 LRU（32） | `server.py` | 请求作用域 |
| 订阅服务登录会话 | `httpx.AsyncClient` 内存 cookie | 401 时重登 |

## 6. 敏感数据分类摘要

| 类别 | 位置 | 保护 |
|---|---|---|
| Zimbra 会话令牌 | `soc_app_sessions.zimbra_token_encrypted` | Fernet（密钥 `APP_SETTINGS_ENCRYPTION_KEY`）；从不公开序列化（`auth.py public_session`）；Node 查询省略该列 |
| 设置机密（提供商密钥） | `app_config` 加密；提供商密钥经 `credentials.set`（只写；`credentials.describe` 仅返回 configured/writable 布尔） | Fernet + 只写 UI |
| 管理员机密 | `SOC_ADMIN_PASSWORD` 仅环境；内存哈希 | 从子进程剔除；时间安全比较 |
| 服务机密（Splunk 令牌、订阅密码、MarkItDown key） | 环境变量 / `.env`（chmod 600） | 从不记日志（`redact_endpoint`、脱敏 `public_status`）；连接检查错误脱敏 Bearer；订阅不外泄远端错误体 |
| 客户数据 | 邮箱、Splunk 结果 | 本系统不存储；Splunk 输出在投影边界脱敏+截断；`AGENTS.md` 禁止跨客户披露 |
