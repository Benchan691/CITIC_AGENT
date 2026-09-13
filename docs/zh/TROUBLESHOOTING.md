# 故障排除（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../TROUBLESHOOTING.md)

**本页读者:** 诊断部署故障的运维与开发者。

**用法:** 按症状领域定位，然后 症状 → 可能原因 → 安全诊断 → 处置 → 验证 → 需上报时收集的证据。这里的每一步诊断都是只读的，或走文档规定的审批流程。**绝不**绕过授权、禁用安全控制、手改生成 bundle，或把工具指向未授权的系统。

**通俗概述。** 大多数故障属于六类之一：缺环境变量、外部服务不可达、构建陈旧、会话过期/被拒、策略拒绝（按设计工作）、或真正被拒的操作。下面的诊断告诉你属于哪种，且安全。

**前置要求:** [DEPLOYMENT_AND_OPERATIONS.md](DEPLOYMENT_AND_OPERATIONS.md)（检查的运行方式）。

---

## 1. 安装与更新

| 症状 | 可能原因 | 安全诊断 | 处置 | 验证 |
|---|---|---|---|---|
| `setup.sh` 列出缺失前置 | Node/pnpm/uv 缺失或版本不符 | 阅读检查器输出（node `^22.19.0\|>=24` 正则） | 按 [GETTING_STARTED](GETTING_STARTED.md) §1 安装；重跑 | `./setup.sh --check` exit 0 |
| Splunk 参数校验失败 | `SPLUNK_MCP_ENDPOINT`/`SPLUNK_TOKEN` 缺失或 URL 带凭据/查询/片段；`http://` 未开 `SPLUNK_ALLOW_INSECURE_HTTP` | 阅读校验错误 | 修 URL 或补令牌；明文 HTTP 需显式选择 | `--check` 通过 |
| `--check` exit 1（N 项） | 从 env 键到 profile 漂移的任何项 | 检查输出点名每个失败区域 | 自上而下修复；重跑 | exit 0 |
| 更新拒绝："working tree is not clean" | 本地修改（未跟踪文件也算） | `git status --porcelain --untracked-files=all` | 自行提交或移除 — update 从不 stash；再跑 `./update.sh` | 更新完成 |
| profile 出现多余/未知插件 | 手动 `pnpm dsh plugin add` 或 profile 迁移中断 | 对比 profile 清单与 `setup.sh` 受管集合 | `./setup.sh --plugins`（清理到受管 SOC 集合） | 检查通过；清单一致 |
| 过时第三方补丁阻塞 profile 修复 | 旧 profile 在 `patchedDependencies` 中仍有 `dsh-auto-collapse@0.1.4` | 检查 profile workspace manifest | 重跑 `./setup.sh --plugins`；迁移清理会先删除过时补丁再让 pnpm 移除插件 | 检查通过；没有第三方补丁 |

**上报证据:** 完整 `./setup.sh --check` 输出；`git rev-parse HEAD` + `git status --porcelain`。

## 2. 认证与归属

| 症状 | 可能原因 | 安全诊断 | 处置 | 验证 |
|---|---|---|---|---|
| 宿主启动即抱怨管理员凭据 | `SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD` 未设置 | 阅读启动错误（消息按设计不泄漏值） | 在环境或 `server/.env` 设置两者；重启宿主 | 宿主启动；管理员登录可用 |
| 登录总是失败 | `APP_POSTGRES_URI` 错误/不可达；Zimbra 拒绝；加密密钥不匹配 | `./setup.sh --check`（Postgres 探测）；日志查 `authentication_required`；用同凭据直接试 Zimbra | 修 URI/密钥；独立验证 Zimbra；重启 | 登录成功 |
| "A new device logged in to this account…" | 单设备策略：另一次登录替换了本会话 | 预期行为 | 重新登录 | 每用户一个活跃会话 |
| 会话早于 24 h 过期 | 上游 Zimbra 令牌失效（改密、管理员撤销） | 后续调用返回 `zimbra_auth_error` | 重新登录 | 新会话正常 |
| 用户无法访问管理端点 | 管理员/用户 Cookie 分层（按设计） | 确认使用的控制台/页面 | 用管理员凭据走 `/admin` | 管理控制台加载 |
| 管理员登录后 RPC 仍 403 | 管理员会话过期（8 h）或宿主重启（内存会话） | `/admin/auth/me` | 重新登录 | `expires_at` 在未来 |
| 建工作区报 `workspace-invalid-path` | 非法名（`..`、分隔符、绝对路径） | 检查请求的名称 | 使用单个目录名 | 工作区出现在 `.data/soc-workspaces/<userId>/` |

**上报证据:** UI/智能体回合的关联 id、日志中的 `soc_correlation_id`、精确错误码、时间戳。

## 3. MCP 发现与"撞名"工具

| 症状 | 可能原因 | 安全诊断 | 处置 | 验证 |
|---|---|---|---|---|
| 模型"应该有"的工具缺失 | 不在原始允许列表（补丁）**或**不在 `DOMAIN_TOOLS`（策略），或桥接被禁用 | 对照 [reference/MCP_TOOL_CATALOG.md](../reference/MCP_TOOL_CATALOG.md)；查启动日志 "official Splunk MCP bridge disabled" | 按 [DEVELOPMENT.md](DEVELOPMENT.md) §6 六合同步清单添加 — 绝不绕门 | 工具出现在 `get-action-catalog` |
| 两个名字像同一个工具（如 `splunk` 出现两次） | `mcp__splunk_mcp__splunk_*` — 一个服务器命名空间 + 原始名 | 阅读 [MCP_AND_TOOL_ROUTING.md](MCP_AND_TOOL_ROUTING.md) §2 | 无 — 预期解剖 | — |
| 调用工具被拒 "This SOC action is disabled by the administrator." | SOC 模式 + 每工具状态 `disabled` | 管理 → Access & approvals | 有意变更状态（或切模式） | 调用经 ask/auto 进行 |
| 拒绝 "This harness exposes only approved Splunk, Zimbra, and subscription tools." | 名字不在 `DOMAIN_TOOLS ∪ CONTROL_TOOLS` — 门在工作 | 在目录中确认名字 | 改用允许列表内工具 | — |
| 检测技能引用的工具不存在 | **已知漂移：** Splunk 栈本轮移除，技能尚未更新 | [DOCUMENTATION_AUDIT.md](DOCUMENTATION_AUDIT.md) §8 | 维护者决策：更新技能或恢复工具 | — |

## 4. Splunk 桥接

| 症状 | 可能原因 | 安全诊断 | 处置 | 验证 |
|---|---|---|---|---|
| setup/`--check` 在 Splunk 上失败，或没有任何 Splunk 工具 | 官方 MCP 连接**必配**；`SPLUNK_MCP_ENDPOINT`/`SPLUNK_TOKEN` 不齐时桥接保持关闭 | 启动日志 "official Splunk MCP bridge disabled" | 两者都写入 `server/.env`；重启 | 日志显示桥接连接；`splunk_get_info` 可用 |
| 桥接调用 TLS 错误 | `SPLUNK_VERIFY_SSL=false` 但端点需要真校验（或反之） | 检查 env 值 | 设 `SPLUNK_VERIFY_SSL=true`（默认）或修端点证书 | 调用成功 |
| URL 校验拒绝配置 | 端点带凭据/查询/片段，或 `http://` 未开明文选择 | 阅读桥接错误 | 修 URL；明文 HTTP 设 `SPLUNK_ALLOW_INSECURE_HTTP=true` | 配置通过 |
| 调用约 185 秒后报错 | 客户端超时（外部服务器慢） | 记录耗时；查外部服务健康 | 降低查询成本；远端 Splunk MCP 服务器自有防护 | 有界查询返回 |
| 结果带截断标记 | 投影 50 KB 上限（按设计） | 找 `\n[official Splunk MCP output truncated…]` | 收窄查询；不要在生产关闭投影 | 完整结果在上限内 |
| 管理 → Connections → Splunk 检查失败 | 该检查现在**经桥接实时调用 `splunk_get_info`** — 失败即真实连通性/凭据问题 | 阅读错误消息（Bearer 已脱敏） | 修端点/令牌/TLS；确认外部服务器可达 | 检查报告 `connected` |

## 5. Zimbra

| 症状 | 可能原因 | 安全诊断 | 处置 | 验证 |
|---|---|---|---|---|
| 每次调用 `zimbra_auth_error` | 上游令牌失效 | 应用会话按设计自动删除 | 重新登录 | 工具恢复 |
| `query_validation_error` | 搜索语法（如 `d:YYYYMMDD` 别名被拒；用 `date:MM/DD/YYYY`） | 错误消息给出建议 | 改述 | 搜索返回 |
| "Set ZIMBRA_ALLOW_SEND=true after review"（`operation_disabled`） | 发送门关闭 | 查 env | 部署决策 — 评审后再开 | 发送 RPC 成功 |
| 过滤器更新被拒 `filter_rules_changed` | 并发规则变更（指纹不匹配） | 重新列过滤器，取新指纹 | 以新 `expected_fingerprint` 重试 | 更新生效 |
| 过滤器更新被拒 `operation_disabled` / redirect-discard 被拒 | `ZIMBRA_ALLOW_FILTER_WRITE` / REDIRECT / DISCARD 门 | 查 env | 刻意门控 — 按政策开启 | — |
| 移动报 `move_verification_failed` | 操作中途文件夹变化（校验步骤拦下） | 重列文件夹 | 重试；工具已返回回滚载荷 | 邮件在预期文件夹 |
| 附件报 `attachment_too_large`/`attachment_encrypted` | 限额（默认 10 MB / 硬顶 100 MB）或受保护文件 | 信封中的错误码 | 用更小/未保护的源；如政策允许再提限额 | 转换成功 |

## 6. 订阅服务

| 症状 | 可能原因 | 安全诊断 | 处置 | 验证 |
|---|---|---|---|---|
| `not_configured` | URL/用户/密码缺失 | 管理 `get-settings` 显示订阅未配置 | 设三个 env 变量；重启 | `test-subscription-server` 通过 |
| `email_server_unavailable` | 超时/5xx/429 上游 | 管理检查；details 中的状态码 | 查外部服务 | 重试成功（可重试码） |
| `email_server_auth_failed` | 服务凭据错误 | 管理检查 | 修 `SUBSCRIPTION_SERVER_USER/PASSWORD`；重启 | 检查通过 |
| 重定向被拒 | 降级或跨主机重定向（策略） | 错误中的状态/URL | 修服务重定向或端点 | 检查通过 |

## 7. 附件转换

| 症状 | 可能原因 | 安全诊断 | 处置 |
|---|---|---|---|
| `attachment_converter_unavailable` | MarkItDown 依赖或可选 LLM extra 缺失 | `uv sync`（启用 LLM 时加 `--extra markitdown-llm`） | 同步；重启 |
| `attachment_invalid_limits` | 客户端限额超出 schema 边界 | 查设置卡的值 | 重置为默认（5 文件 / 10 MB / 50 MB / 200 k / 500 k 字符） |
| 上传在转换前被拒 | 客户端限额预检 | 输入区显示具体限额 | 减少选择 |
| "text was truncated during conversion" | `max_chars` 钳制（按设计） | 预期标记 `text_truncated` | 如政策允许再提限额 |

## 8. 数据库

| 症状 | 可能原因 | 安全诊断 | 处置 | 验证 |
|---|---|---|---|---|
| 所有工具 `authentication_required` | Python 启动时无 Postgres | 查 `APP_POSTGRES_URI` 链 | 修 URI；重启 | 登录可用 |
| 解密 RuntimeError 提到密钥不匹配 | `APP_SETTINGS_ENCRYPTION_KEY` 被改 | 错误指明行数/数据库 | 恢复旧密钥（或有意识地接受数据丢失） | 错误消失 |
| 迁移失败 `schema_migration_failed` | Postgres 不可达或 URI 错误 | 管理 `migrate` RPC 的错误；日志 | 修 URI/库；重启（启动时 `apply_migrations` 重试） | `{"migrated": true}` |
| 查询慢/失败 | 连接池耗尽或长语句 | 配置了 `statement_timeout=15000`；日志查超时 | 查 DB 健康；每主体信号量（2）按设计限流 | 延迟恢复 |

## 9. UI / 构建

| 症状 | 可能原因 | 安全诊断 | 处置 | 验证 |
|---|---|---|---|---|
| UI 改动不出现 | 某个被跟踪的 SOC 浏览器 bundle 未重建 | 对比负责该功能的 `packages/soc-agent-*/lib/client.js` 与源码 | `./setup.sh --plugins`（或重建负责该功能的包）；刷新 | 改动可见 |
| setup 报 SOC 浏览器 bundle 漂移 | bundle 含允许列表之外的 `require()` | 阅读 setup 输出中的包名 | 重跑 setup（自动重建 36 包 / 26 包面矩阵） | 漂移检查通过 |
| `/admin` 返回 503 | harness 前端 index 未找到（构建产物缺失） | `setup.sh --check` 构建产物段 | `./setup.sh --plugins --rebuild` | `/admin` 可服务 |
| 应用加载但全部失效 | Python 服务器死亡（拉起失败致命 — 更可能是 env/存储问题） | 启动日志；在 `apps/soc-agent/server` 冒烟跑 `uv run unified-mcp-server` | 修 env/uv；重启 | 工具响应 |

## 10. 补丁、测试与更新

| 症状 | 可能原因 | 安全诊断 | 处置 |
|---|---|---|---|
| 改补丁后 `skills.test.js` 失败 | 名册断言漂移 | 对照 `cordis.patch.yml` 与钉扎 | 有意更新 + 同步测试 |
| `policy.test.js` 计数失败 | 工具清单变更 | 见 [DEVELOPMENT.md](DEVELOPMENT.md) §6 | 双端 + 计数一起更新 |
| `sections.test.ts` 在 UI 编辑后失败 | 护栏文案/结构变更 | 阅读失败正则 | 恢复文案或有意更新护栏 |
| 测试挂起 | 环境缺 `uv run python`（控制服务器子进程测试） | `uv --version` | 安装 uv / 激活 venv |
| 宿主 JS 测试 `ERR_MODULE_NOT_FOUND: '@deepseek-ai/schemastery'`（新环境实测） | 应用 `node_modules` 缺 pnpm 工作区链接 | — | `./setup.sh --plugins`（harness `pnpm install`） |
| Python 收集错误 `No module named 'mcp'/'zimbra_client'`（新环境实测） | 虚拟环境不完整 | — | `apps/soc-agent/server` 内 `uv sync --extra test` |
| `./update.sh` 报 usage 错误 | 传了参数（它不接受） | — | 不带参数运行 |

**上报证据（通用）:** `git rev-parse HEAD`、分支、失败命令完整输出、含 `soc_correlation_id` 的相关日志行、以及策略意外时的确切工具名与管理端 Access & approvals 状态。分享前**脱敏凭据与客户数据**。
