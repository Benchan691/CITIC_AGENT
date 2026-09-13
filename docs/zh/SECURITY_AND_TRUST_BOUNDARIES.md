# 安全与信任边界（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../SECURITY_AND_TRUST_BOUNDARIES.md)

**本页读者:** 安全评审者、规划授权评估的渗透测试人员、以及需要做风险决策的维护者。

**读完后你将了解:** 资产、行为者、入口与信任区；每项控制及其证据等级（文档化控制 / 测试证据 / 纵深防御 / 运维假设 / 建议）；以及如实列出的残余风险。

**通俗概述。** 系统的核心承诺是：一个只能调用显式允许工具的模型、以服务端验证的用户身份运行、任何变更需人审批、且没有任何模型可达的 shell、文件系统或邮件发送路径。下表列出每项控制与其证据强度 — 同时如实列出部署可能受伤之处。

**前置要求:** [AUTHENTICATION_AND_OWNERSHIP.md](AUTHENTICATION_AND_OWNERSHIP.md)；[MCP_AND_TOOL_ROUTING.md](MCP_AND_TOOL_ROUTING.md)。

---

## 1. 资产、行为者、入口、信任区

| 资产 | 敏感度 | 存储位置 |
|---|---|---|
| Zimbra 会话令牌 | 高 — 以用户身份访问邮箱 | `soc_app_sessions`（Fernet 加密） |
| 提供商 API key、服务机密 | 高 | `app_config`（Fernet）、credentials API（只写）、`.env`（0600） |
| 管理员凭据 | 高 | 仅环境变量（不存储、不转发给子进程） |
| 调查内容（邮件、Splunk 结果） | 高（客户数据） | **本系统不持久化**；仅在会话/工作区中瞬时存在 |
| 会话/归属声明 | 中 | Postgres |
| 对话工件 | 中 | 按用户工作区目录 + harness 状态（`.data/`、`.state/`） |

**行为者:** 分析师（已认证）、管理员（已认证）、模型（不可信的指令执行者）、外部服务（Zimbra、Splunk MCP、订阅、LLM 提供商）、检索内容（不可信证据）。

**入口:** HTTP 路由（`/auth/*`、`/admin/*`、`/api/*`、`/soc-agent-config`）、WebSocket（`/api/events.mux|host`）、MCP stdio 管道（父子）、控制通道管道、CLI 入口（运维本地）。

**信任区:** 浏览器（不可信）· Node 宿主（可信核心）· Python 子进程（可信、更窄）· 外部服务（半可信、凭据限定）· 模型/检索内容（不可信）。

数据流图: 英文站 [site/security.html](../site/security.html)；可编辑源 [diagrams/data-trust-boundaries.mmd](../diagrams/data-trust-boundaries.mmd)。

## 2. 控制清单（含证据等级）

### 身份与会话

| 控制 | 等级 | 证据 |
|---|---|---|
| Zimbra 后端登录；通用失败；不回显密码 | 文档化 + **测试证据** | `auth.test.js`、`test_auth.py` |
| 24 h 服务端会话过期；HttpOnly/SameSite=Lax(+Secure) Cookie | 文档化 + 测试证据 | `auth.test.js`；`ownership.js` |
| 单设备替换与一次性撤销通知 | 文档化 + 测试证据 | `auth.test.js`（"revoking an application session…"） |
| 管理员：启动时必需的环境凭据、时间安全比较、内存哈希令牌、8 h TTL | 文档化 + 测试证据 | `auth.test.js` |
| 管理/用户 Cookie 按 API 分层隔离 | 文档化 + 测试证据 | `auth.test.js`（"admin cookies cannot authorize chat APIs…"） |
| CSRF 姿态：认证路由同站/Origin 检查；SameSite=Lax Cookie | 文档化控制 | `ownership.js sameSiteRequest`（无专门 CSRF 测试 — 见残余风险） |

### 隔离

| 控制 | 等级 | 证据 |
|---|---|---|
| Postgres 归属声明；9 域受限 API 代理；11 个跨用户变更被拒 | 文档化 + **测试证据** | `auth.test.js` IDOR 测试 |
| 工作区路径包含性（拒穿越/符号链接逃逸） | 文档化 + 测试证据 | `auth.test.js` 工作区测试 |
| 服务端生成会话 id（防占位） | 文档化 + 测试证据 | `auth.test.js` |
| 事件流按用户过滤/脱敏（凭据引用、外来会话、流错误） | 文档化 + 测试证据 | `auth.test.js` |
| 审批答复只能命中本人的挂起请求 | 文档化 + 测试证据 | `auth.test.js`（"scoped response handling…"） |
| 客户数据隔离 | 运维假设（政策在 `AGENTS.md`；不存在可泄漏的跨客户状态） | `AGENTS.md` |

### 工具与变更

| 控制 | 等级 | 证据 |
|---|---|---|
| 每服务器原始允许列表（`allowedToolNames`） | 文档化 + 测试证据 | `mcp-discovery.test.js`、`skills.test.js`、`splunk-bridge.test.js` |
| 精确名宿主策略门；拒绝未知工具 | 文档化 + **测试证据** | `policy.test.js` |
| 动作模式不能扩大允许列表（Full access 只改变处理方式） | 文档化 + 测试证据 | `policy.test.js` |
| 变更默认 `ask`；harness 审批瀑布失败关闭 | 文档化 + 测试证据 | `policy.test.js`；上游审批插件（文档化控制） |
| MCP 侧变更门（`ZIMBRA_ALLOW_*`）+ 过滤器指纹 | 文档化 + 测试证据 | `test_zimbra_service.py`、`test_zimbra_filters.py`（与界面层构成纵深防御） |
| 邮件：仅草稿工具；界面确认；服务门；`sent:true` 校验 | 文档化；**确认对话框本身是界面级控制** | `EmailDraftToolview.tsx`、`auth_cli.py`、`test_zimbra_service.py` |
| 无 Splunk 变更工具（桥按允许列表只读；Splunk 栈已删除） | 文档化 + 测试证据 | `test_server_tools.py`、`splunk-bridge.test.js` |
| Splunk 端点配置校验（无凭据/查询/片段；明文 HTTP 须显式选择） | 文档化 + **测试证据** | `splunk-bridge.test.js`（"official configuration requires MCP credentials and explicit plain HTTP opt-in"） |
| 管理连接检查对错误脱敏 Bearer 令牌 | 文档化 + **测试证据** | `splunk-bridge.test.js`（"admin connection check uses the live allowed tool…"） |
| 只读 Splunk 边界的构成方式 | 文档化控制 | 桥接没有协议级写过滤 — 边界 = 允许列表 + 策略 + 远端服务器（见残余风险） |

### 内容处理

| 控制 | 等级 | 证据 |
|---|---|---|
| Splunk 输出投影：PII 掩码 + 50 KB 截断 | 文档化 + 测试证据 | `investigation.test.js` |
| 抗指令注入（`AGENTS.md` 模型政策） | 运维假设 | 模型层；无法技术保证 |
| 工具结果的不可信内容边界 | 文档化控制 | 信封 + 通用 `internal_error`（不泄漏第三方文本） |
| 背景/指令注入上限（64 KiB 渲染、1 MiB 源） | 文档化 + 测试证据 | `background.test.js` |
| 附件转换限额 + 归档安全 + 加密文件检测 | 文档化 + 测试证据 | `test_zimbra_service.py`、SOC 浏览器包测试 |
| 远端错误体不外泄（订阅）、上游异常文本不外泄（Python） | 文档化 + 测试证据 | `test_email_service.py`、`test_config.py` |

### 平台

| 控制 | 等级 | 证据 |
|---|---|---|
| 模型可见的 shell/文件系统/子代理/任务/目标工具经补丁禁用 | 文档化 + **测试证据** | `skills.test.js`（"SOC profile disables native shell…"） |
| 技能目录经 `customSkillDirs` 限定 | 文档化 + 测试证据 | `skills.test.js` |
| 机密不进入子进程环境 | 文档化 + 测试证据 | `auth.test.js`（"without exposing tokens"）、`python-command.js` |
| 会话 id 的 SQL 边界；加密列；`statement_timeout=15000` | 文档化控制 | `postgres_store.py` |
| TLS 校验默认开启（桥、Zimbra、订阅） | 文档化 + 测试证据 | `splunk-bridge.test.js`（"verifies TLS by default"）、`test_splunk_service.py`（历史） |
| 依赖钉扎：vendored harness（工作区）、`markitdown==0.1.7`、提交钉扎的外部插件 + 本地补丁 | 文档化控制 | `pyproject.toml`、`requirements.txt`、`patches/` |

## 3. 威胁场景与遏制

| 场景 | 遏制 |
|---|---|
| 钓鱼邮件中的提示注入（"删除所有过滤器"） | 检索内容是证据不是指令（`AGENTS.md`）；任何过滤器变更都是 `ask` 动作需人批准；模型没有隐藏工具 |
| 模型尝试未注册工具（如 `bash`） | 三次拒绝：未注册（注册表）、不在受限集、不在 `DOMAIN_TOOLS`（`policy.test.js` 显式拒绝 `bash`） |
| 被窃取的分析师 Cookie | HttpOnly + SameSite + 服务端过期；单设备策略在下次登录时撤销；撤销会中断在用流 |
| 被窃取的管理员 Cookie | 仅内存 8 h；宿主重启即失效；管理面限于状态/审批/提供商 |
| 跨用户会话/工作区访问（IDOR） | 受限代理拒绝/过滤；归属声明双重校验（`sessionBelongsToUser`） |
| 恶意附件（zip 炸弹、加密、超大） | 大小/字符限额、归档成员与展开大小检查、加密检测、全内存、有界 worker |
| 被攻陷的外部 Splunk MCP 服务器 | 只能返回数据 — 进入模型前已脱敏/截断且仅为证据；它只拿到服务令牌 |
| 有仓库访问权限的内部人员 | 仓库无机密（`.env` 忽略；`.env.example` 只有占位形状）；文档不含实值 |

## 4. 残余风险、未知与建议

1. **只读 Splunk 是组合性的，不是协议强制的。** 若有人同时把写名加进桥接与补丁，只有测试与评审能拦截。*建议:* 把 `skills.test.js`/`splunk-bridge.test.js` 作为发布门。
2. **Send 确认是界面级的。** 服务端强制认证、门控与回执校验，但不要求每次发送的确认令牌；持有有效会话的非浏览器客户端可不经对话框调用 `send-email`。*建议（产品决策）:* 如威胁模型要求，增加服务端确认令牌。
3. **除同站/Origin 检查外无 CSRF 令牌**（认证路由）；其余 POST 路由依赖圈栏 + JSON 内容类型。*建议:* 若部署引入第三方源，考虑显式 CSRF 令牌。
4. **保留的 Splunk 代码 — 本轮已解决。** 整个 Python Splunk 栈已删除（记录于 `docs/SHORTENING_PLAN_IMPLEMENTATION.md`）；`test_server_tools.py` 仍是防复活的门。新的相邻风险是**技能漂移**：`detection-engineering`/`spl-writing` 仍在讲授工具已不存在的流程。
5. **仓库根部无 CI** — 上述守卫只有运行才会生效。*建议:* 把三个套件接入 CI。
6. **`lib/` 是被跟踪的生成产物** — 被篡改或陈旧的 bundle 会静默上线。setup 的 require 允许列表检查可缓解；*建议:* 评审时核对 bundle 漂移。
7. **未知项:** 外部服务防护（Splunk MCP 服务器策略、Zimbra 加固、订阅服务）在本仓库之外；反向代理拓扑对 Cookie 标志的影响取决于环境。

## 5. 图

动作授权决策树见英文站 [site/security.html](../site/security.html)；可编辑源 [diagrams/action-authorization.mmd](../diagrams/action-authorization.mmd)。

## 仓库中的证据

- 上文每张表都引用测试名；运行方式见 [TESTING.md](TESTING.md)。
- 治理政策: `AGENTS.md`（强制）、`BACKGROUND.md`（证据注意事项）。
- 论断级映射: [reference/TRACEABILITY_MATRIX.md](../reference/TRACEABILITY_MATRIX.md)。
