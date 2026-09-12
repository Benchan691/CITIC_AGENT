# 用户界面与动作模式（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../USER_INTERFACE_AND_ACTION_MODES.md)

**本页读者:** 使用产品的分析师、配置系统的管理员、改动 UI 的开发者。

**读完后你将了解:** 每个界面区域、每个控件的作用、哪些决策只是便利而哪些有服务端强制，以及 Full access、SOC mode、每工具状态与邮件 Send 确认的精确语义。

**通俗概述。** 浏览器里有两个应用：分析师工作区（登录遮罩、带附件的聊天、动作模式菜单、邮件草稿卡）和 `/admin` 的独立管理控制台（状态、智能体上下文、访问与审批、AI 提供商）。UI 对边界很诚实：只显示状态而不显示机密，禁用服务端禁止的东西，从不把自己当作执行者。

**前置要求:** 无；工具名见 [reference/MCP_TOOL_CATALOG.md](../reference/MCP_TOOL_CATALOG.md)。

---

## 1. 分析师工作区

| 区域 | 组件 | 行为 |
|---|---|---|
| **登录门** | `AuthGate.tsx` | 全屏 "Sentinel login" 对话框覆盖 shell（槽位优先级 −100）直至认证；每 30 秒及 focus/visibility 时轮询 `GET /auth/me`；登录失败在 `role="alert"` 中显示 "Invalid email or password."；密码在成功*和*失败后都清空；已认证时显示 `zimbra_email` 与 Logout。服务端强制：无论遮罩与否，路由都被圈栏。 |
| **品牌** | `CiticBrand.tsx` | 侧栏与首屏的 "Sentinel" 标志/字标（便利项）。 |
| **输入区附件** | `MarkItDownDocuments.tsx` + `markitdownAttachments.ts` | 隐藏文件选择器（也可经 `attach-file` 命令）；每条消息的附件栏，状态为 Queued/Converting…/Ready/error；限额来自设置（默认 5 个文件、10 MB/文件、50 MB 总量、200 k 字符/文件、500 k 总字符）；经 `convert-attachment` 转换，**两个 worker** 并行、保序、成功结果按限额缓存；截断结果有摘录提示。 |
| **动作模式菜单** | `SocActionPolicyMenu.tsx` | 输入区左侧菜单：**Full access**（"Run every permitted tool directly"）与 **SOC mode**（"Apply each tool's ask, auto-run, or disabled setting"）。经 `get-action-policy`/`set-action-mode` 读写；采纳服务端确认值；畸形响应失败关闭（绝不自造模式）。会话级：登出或宿主重启后回到部署默认。 |
| **草稿卡** | `EmailDraftToolview.tsx` | 在工具调用块内渲染，键于草稿**与转发**工具。见 §3。 |
| **会话/权限** | Harness shell | 服务端受限 API 使文件夹归服务端所有（客户端 `api.folders = undefined`）— 会话创建落在用户的服务端工作区内。 |

## 2. 管理控制台（`/admin`）

仅当 `window.location.pathname` 以 `/admin` 开头时挂载（源码护栏 `sections.test.ts` 强制）。独立登录（`soc_admin_session`）。页面（hash 路由，惰性挂载）：

| 页面 | 控件 | 服务端行为 |
|---|---|---|
| **Connections** | Splunk 卡 *Check*（`test-splunk` = **经桥接实时执行 `splunk_get_info`**）、Zimbra/MarkItDown "Environment managed" 卡、Subscription 卡 *Check*（`test-subscription-server`）；状态徽章 Checking…/Connected/Unavailable/Configured/Not configured；结构化状态提示（`role=alert`/`status`）带重试 | `get-settings` 只返回**状态**（含 `official_mcp_enabled`）；"Configuration stays in the server .env file" — 这里不能编辑任何值 |
| **Agent context** | BACKGROUND.md 注入开关 + `repeatEveryUserPrompts`（≥0，默认 5）；时间上下文注入开关 + 间隔 | 经 `settings.mutate` 写 `soc-background`/`time-context`（revision 校验）；实时生效 |
| **Access & approvals** | 部署模式单选 **Full access / SOC mode**；按工具分组的 **Ask / Run automatically / Disabled** 单选组；UI 确认条目显示只读 "Explicit confirmation" 徽章；禁用工具显示 "Unavailable" | 写 `soc-action-approval`（`mode` + `actionStates`，revision 校验）；由 `host.js tools/pre-execute` 强制；页面提示："Email delivery still requires the explicit Send confirmation in the draft view" |
| **AI providers** | 提供商选择器（listbox，凭据圆点与模型数）；自定义提供商（路由校验、路由不可变）；API key 密码框（"Stored securely · enter a new key to replace it"）；**Discover models** 经 `llm.discoverModels`；移除 = 两步内联确认 | 密钥**只写**（`credentials.set/unset`；`describe` 只返回 configured/writable 布尔）；设置写入 `llm-pi-ai` 命名空间 |

遗留兼容卡（`SplunkSettings`、`SubscriptionServerSettings`）已在本轮删除；`ZimbraSettings` 静态卡保留；`AdminConsole` 仍被测试约束不得引用已删卡片。

## 3. 邮件草稿卡与 Send 门

状态机: `editing → sending → sent | failed | discarded`（discarded 可 Reopen；失败后按钮变 Retry）。

1. 模型调用 `zimbra_send_email`、`zimbra_use_signature_on_email` 或 **`zimbra_forward_email`**（新增：读取原信，内嵌 `forward_message_id` 与 `forwarded_message` 元数据 — 主题/发件人/日期/正文/附件）→ **本地草稿**作为工具结果返回 → 卡片渲染可编辑表单（To/CC/BCC 分隔符感知解析并去重；主题 ≤998；正文 ≤18 000；text/HTML 格式）。转发草稿在笔记旁显示原信元数据。
2. **Add signature** 加载 `list-signatures` 并按签名格式把所选签名合并到正文上方/下方。
3. 点 Send：客户端校验（≥1 个 To 收件人、主题非空）→ **`window.confirm('Send this email now?')`** → 携带精确字段的 `send-email` RPC。
4. 仅当响应满足 `result.sent === true` 才翻到 "Email sent successfully"；其他一律成为 `failed` 卡（`role="alert"` 展示错误）。缺少回执时明确显示 "Zimbra did not confirm that the email was sent."

**便利 vs 强制：** `window.confirm` 对话框是界面级控制。服务端强制：RPC 的用户认证、会话身份、`ZIMBRA_ALLOW_SEND` 门、以及 Zimbra 回执校验后才报告成功。没有服务端确认令牌（见 [TRACEABILITY_MATRIX](../reference/TRACEABILITY_MATRIX.md) #34）。模型**没有**发信路径 — 它拥有的工具只构建草稿；转发投递时由服务端附上原信与附件。

## 4. 便利 vs 强制（摘要表）

| 界面决策 | 有服务端强制吗？ |
|---|---|
| 登录遮罩可见性 | 有 — 路由/传输圈栏独立强制 |
| 附件客户端限额 | 部分 — 客户端预检；服务端限额（`attachment_*` 错误码）才是权威 |
| 动作模式切换 | 有 — `set-action-mode` 服务端校验 + 会话内存映射；策略门强制状态 |
| 管理每工具清单 | 有 — 设置就是策略门读取的源 |
| 草稿卡校验（收件人/主题） | 部分 — Python 在草稿构建与投递时再次校验 |
| Send 确认对话框 | **仅界面**；服务端改为强制认证 + 门 + 回执 |
| 状态卡（Splunk/订阅） | 有 — 脱敏状态来自服务端；配置按设计不可在 UI 编辑 |

## 仓库中的证据

- `packages/soc-agent-client/src/client/` — 上述全部组件；`sections.test.ts` 钉住挂载、文案与只写凭据行为。
- `apps/soc-agent/host.js`（`get/set` 策略端点、`requireUser/requireAdmin`）、`apps/soc-agent/ownership.js`（会话模式映射）。
- 图: [diagrams/action-authorization.mmd](../diagrams/action-authorization.mmd)、[diagrams/email-draft-send.mmd](../diagrams/email-draft-send.mmd)；英文站可交互版本见 [site/flows.html](../site/flows.html)。

## 未知项

- 非草稿工具的 harness 原生工具视图渲染（上游 UI，不在范围内）。
- `window.confirm` 在嵌入式 webview 中的行为取决于环境。
