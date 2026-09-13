# 数据与持久化（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../DATA_AND_PERSISTENCE.md)

**本页读者:** 规划备份/保留策略的运维、改动状态的开发者、跟踪敏感数据的评审者。

**读完后你将了解:** 每个存储与瞬时状态位置、所属进程、Schema/键控、加密、读写路径、并发行为、失败行为与备份含义。运行时目录只做结构性描述 — 本文档刻意不检查其内容。

**通俗概述。** 真正重要的持久存储只有 PostgreSQL：用户、应用会话（Zimbra 令牌加密存储）、会话撤销、归属声明、Fernet 加密配置。用户工作文件在 `.data/soc-workspaces/<userId>/` 之下。邮件草稿只存在于对话中。Schema 现由**版本化 SQL 迁移**（advisory lock + 版本台账）管理；本地账户文件是遗留；旧的 SQLite 证据存储已随 Splunk 栈删除。

**前置要求:** [ARCHITECTURE.md](ARCHITECTURE.md)；细节见 [reference/DATA_STORE_CATALOG.md](../reference/DATA_STORE_CATALOG.md)。

---

## 1. 存储目录（已验证）

| 存储 | 所属进程 | Schema/来源 | 内容 | 键控 | 加密 |
|---|---|---|---|---|---|
| **PostgreSQL** | Node（`SocStateStore`，池 max 10）+ Python（`PostgresStore`，池 1–4，`statement_timeout=15000`） | `migrations/*.sql` 经 `schema.py` 应用（advisory lock；`soc_schema_migrations` 台账） | 10 张表 — 见下 | `id` UUID / 邮箱唯一 | `app_config.value_encrypted`、`zimbra_token_encrypted`、`password_encrypted` — Fernet（`APP_SETTINGS_ENCRYPTION_KEY`） |
| **按用户工作区目录** | Node 宿主（归属代理） | `MCP_SERVER_ROOT/.data/soc-workspaces/<userId>/[general]` | 用户会话/工作工件 | 目录 = 用户 id | 无（文件系统权限；由代理按用户限定） |
| **Harness 状态** | Node 宿主 | `.data/`、`.state/`（gitignored） | 会话、预设等 | harness 内部 | harness 内部 |
| **setup 指纹** | `setup.sh` | `.data/harness-{install,build}.sha256` | 门控安装/构建的内容哈希 | — | — |
| **被跟踪的 SOC 浏览器 bundles** | 构建 | `packages/soc-agent-*/lib/` | core、隔离界面和可选 feature 的浏览器 bundle | — | — |
| **本地账户文件（遗留）** | Python 管理/兼容 | `.data/zimbra_accounts.enc` + `.key`（Fernet；`0o600`；原子替换） | 存储的邮箱凭据 | 账户 id | Fernet |

**Postgres 表:** `soc_users`、`soc_app_sessions`（含用户/过期索引）、`soc_session_revocations`、`soc_workspace_owners`、`soc_session_owners`（含索引）、`soc_folder_owners`、`soc_bootstrap`、`soc_schema_migrations`（迁移台账）、`app_config`（加密设置）、`zimbra_accounts`（遗留）。`002_remove_catalog.sql` 按标记删除八张遗留目录表。

## 2. 数据归属与键控

- **用户**按规范化的 Zimbra 邮箱键控（casefold + 形状校验；有效性由 Zimbra 决定）。每邮箱一行；登录时维护 `last_login_at`。
- **应用会话**是随机不透明 id（校验 `^[A-Za-z0-9_-]+$`），TTL 24 h，外键级联到用户行。
- **归属声明**把 harness 对象 id（工作区/会话/文件夹）绑定到用户 id。会话的归属仅在其父工作区同样归属时有效（`userSessionIds` 的连接）。
- **设置**是命名空间化的键（`soc-action-approval`、`soc-background`、`soc-agent-markitdown-attachments`、`time-context`、`llm-pi-ai`），带乐观并发（`expectedRevision`）。
- **证据作用域**（原留存代码）：sha256(principal+investigation+customer) — 已随 Splunk 栈删除。

## 3. 读写路径

| 写入 | 路径 |
|---|---|
| 登录 | `auth_cli login` → `create_user_session`（upsert 用户；加密令牌；撤销其他会话；插入会话） |
| 归属声明 | `claimWorkspace` / `claimSession` / `claimFolder`（属主保护的 upsert，`ON CONFLICT DO NOTHING` + 复核） |
| 设置变更 | 管理控制台 → `settings.mutate`（revision 校验）→ 加密 `app_config` 行 |
| 会话结束 | `delete_app_session`（登出、`zimbra_auth_error` 清理） |
| 提供商密钥 | `credentials.set` → 加密存储；`credentials.unset` 移除 |
| 对话工件 | harness 会话持久化 → `.data`/`.state` + 按用户工作区（仅服务端选定路径） |

读取走同一组模块；**Node 层从不查询 `zimbra_token_encrypted`** — 会话投影（`SocStateStore.session`、`auth.py public_session`）只暴露 id/用户/邮箱/过期时间。

## 4. 保留与清理

| 数据 | 保留 |
|---|---|
| 应用会话 | 24 h TTL；读取时惰性删除过期行；无后台清扫器 |
| 会话撤销 | 有过期时间；被消费（一次性）即删行 |
| 归属声明 | 随工作区删除（`deleteWorkspace` 级联会话属主）；文件夹删除时解除声明 |
| `app_config` | 直到被修改/删除（无 TTL） |
| 遗留 `zimbra_accounts` | 活跃路径不触碰；遗留目录表由 `002_remove_catalog.sql` 按标记删除 |
| 对话/工作区 | 第一方代码未定义自动保留策略 — **未知**；由部署决定 |
| SQLite 证据存储 | 已随 Splunk 栈移除；磁盘上可能残留旧文件（可归档/删除） |

## 5. 并发与锁

- `claimSession`/`claimWorkspace`：DB 级 upsert 守卫 + 插入后复核（竞争时输家看到归属属于他人而失败）。
- 设置：revision 校验的变更（乐观锁）— 陈旧保存被拒绝。
- 过滤器写入：活动 Zimbra 规则集的 SHA-256 指纹（`expected_fingerprint`）— 并发外部变更 → `filter_rules_changed`，刷新后重试。
- 阻塞工作：全局信号量 8 / 每主体 2，shielded 任务（被取消的等待者永不释放 worker 槽位）。
- 迁移：`pg_advisory_xact_lock(hashtext('soc-agent-schema'))` 序列化启动；版本行 `ON CONFLICT DO NOTHING` 幂等。
- 订阅：单进程内 httpx 客户端；登录按"每批一次"设计串行化（有测试）。

## 6. 失败行为与备份含义

- **启动时 Postgres 不可达:** Node 存储退化为空操作（归属相关调用默认拒绝）；Python 服务器每次调用抛 `authentication_required` — 登录不可能，即预期的失败关闭姿态。
- **加密密钥不匹配:** 解密失败抛出指明行数、数据库与修复方法的 RuntimeError — 数据不会被静默丢失或静默可读。
- **备份:** 一起备份 PostgreSQL **和** `APP_SETTINGS_ENCRYPTION_KEY`；没有密钥，`app_config`、令牌与遗留账户密码不可恢复。`.env` 文件是部署机密（在 Git 之外备份）。工作区是普通目录（可 rsync）但含用户数据 — 按敏感处理。
- **恢复:** Schema 为 `IF NOT EXISTS`，向既有 Schema 还原行即可；`soc_bootstrap`/`soc_schema_migrations` 标记使迁移一次性且幂等。

## 7. 敏感字段摘要

| 字段 | 位置 | 处理 |
|---|---|---|
| Zimbra 令牌 | `soc_app_sessions.zimbra_token_encrypted` | Fernet；Node 读取与公开序列化都排除 |
| 设置机密 | `app_config.value_encrypted` | Fernet |
| 提供商密钥 | credentials 存储 | 只写 API 面 |
| 管理员密码 | 仅环境变量 | 从子进程剔除；时间安全比较；不存储 |
| 邮件/Splunk 内容 | 不持久化 | 瞬时；进模型前投影/脱敏 |

相关: [reference/DATA_STORE_CATALOG.md](../reference/DATA_STORE_CATALOG.md)（完整目录）、[CONFIGURATION.md](CONFIGURATION.md)（机密）、[SECURITY_AND_TRUST_BOUNDARIES.md](SECURITY_AND_TRUST_BOUNDARIES.md)。
