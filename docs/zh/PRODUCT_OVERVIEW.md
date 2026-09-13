# 产品概述（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../PRODUCT_OVERVIEW.md)

**本页读者:** 所有人 — 尤其是评估或上手本系统的非开发者。

**读完后你将了解:** 业务问题、目标用户、支持的工作流、产品**刻意不做**什么，以及塑造每个设计决策的安全哲学。

**通俗概述。** SOC 分析师每天要在满屏钓鱼邮件的 Zimbra 和事件如山的 Splunk 之间来回切换。SOC Agent 把两者放进同一个聊天窗口：分析师以本人身份登录，用自然语言发起调查，智能体通过一个小型、明确允许的只读工具集查询 Splunk 和分析师本人的邮箱。证据返回前会做脱敏与限幅。需要动作时 — 移动钓鱼邮件、建邮箱规则、起草处置邮件 — 智能体提出、分析师批准，系统在服务端强制执行该审批。邮件只有人点击草稿视图的 **Send** 才会投递。浏览器界面采用模块化设计：强制核心与隔离的侧栏/工作区始终可用，品牌、管理、动作策略、附件和邮件草稿功能可独立选择。

**前置要求:** 无。

---

## 1. 业务问题

客户安全调查需要在互不相通的系统中往返：Zimbra 里的举报邮件、Splunk 里的检测告警与原始遥测、内部服务里的订阅/联系人记录。纯手工既慢又易错；交给一个不受约束的 AI 又不安全。本产品是两者之间的受控中间地带：一个有刚好够用的调查工具、且每个硬边界都阻止其做任何未经人类批准之事的 AI 智能体。

## 2. 目标用户

| 用户 | 认证方式 | 能做什么 |
|---|---|---|
| **SOC 分析师** | 本人 Zimbra 邮箱 + 密码 | 调查 Splunk、检索/读取本人邮箱、创建邮件草稿、提出需审批的变更、使用技能 |
| **管理员** | 静态 `SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD` | 配置访问模式与每工具审批、查看服务状态、管理智能体上下文（BACKGROUND.md 节奏）、配置 AI 提供商（只写凭据） |

一人可兼任两者，会话相互独立（不同 Cookie、不同存储 — 管理员会话在内存中 8 小时，分析师会话在 Postgres 中 24 小时）。

## 3. 支持的工作流

1. **Splunk 调查**（技能 `splunk-investigation`）：围绕 IP、主机、用户、告警或时间线提问；智能体通过 `mcp__splunk_mcp__*` 只读工具执行有界查询，并给出带置信度与局限性的证据报告。
2. **邮件分诊**（邮箱工具）：列文件夹、搜索、读信/读头、提取附件文本（MarkItDown）— 永远只针对登录用户自己的邮箱。
3. **邮件 + Splunk 关联**：读举报邮件，再把其中的指标转入 Splunk 搜索。
4. **误报分析**（技能 `false-positive-analysis`）：解释告警为何触发、判定恶意/良性/不确定、提出最窄的安全调参建议。
5. **检测工程**（技能 `detection-engineering`、`spl-writing`）：检视现有规则、编译 CITIC 生产 SPL、验证、安全回测 — 然后把**禁用状态**的定义交给外部人工 Splunk 部署流程。应用自身从不部署。*本轮提示：相关编译工具已随 Splunk 栈移除，这两个技能暂为陈旧状态。*
6. **邮箱变更**（需审批）：移动邮件、建文件夹、管理签名、创建/更新/重排过滤规则（带指纹乐观并发）。
7. **邮件起草与发送**：智能体起草（含**转发草稿** — 读取原信并附带转发元数据）；分析师在草稿视图编辑并发送。
8. **订阅管理**（需审批）：在外部服务上列出/预览/创建/更新/删除邮件订阅。

## 4. 非目标（刻意的，已在代码中验证）

- **不自主监控。** 智能体只按请求行动（`AGENTS.md`：不轮询、不盯屏）。
- **不对 Splunk 做任何变更 — 也没有任何 Splunk 代码。** 桥接允许列表只含读工具，而且本轮已把整个进程内 Python Splunk 栈删除（`test_server_tools.py` 仍断言 `soc_agent` 上不存在 `splunk_*` 工具）。
- **不部署检测。** 应用从不写检测；此前负责准备交接定义的 CITIC 编译器本轮已移除，检测工作完全发生在应用之外（见下方技能漂移提示）。
- **没有模型驱动的邮件投递。** `zimbra_send_email` 与 `zimbra_forward_email` 只生成本地草稿；只有界面 Send 确认才触发投递。
- **不存储邮箱凭据。** 遗留账户存储在运行时被 `EmptyAccountStore` 中和；智能体使用登录用户自己的会话令牌。
- **模型没有 shell、文件系统、编码工具。** cordis 补丁禁用了这些插件族；模型只能用允许列表内的 SOC 工具。
- **不处理跨客户数据。** `AGENTS.md` 禁止把一个客户的数据暴露给另一个客户；身份永远是认证用户本人。

## 5. 术语

完整词汇表见 [reference/GLOSSARY.md](reference/GLOSSARY.md)（MCP、SPL、cordis、动作模式、removed 代码……）。简版：**`soc_agent`** 是本地 Zimbra/订阅工具服务器；**`splunk_mcp`** 是由外部端点提供、经桥接暴露的只读 Splunk 工具命名空间；**Full access / SOC mode** 决定已批准工具是直接执行还是遵循每工具的 ask/auto/disabled 设置。

## 6. 主要能力一览

| 能力 | 位置 |
|---|---|
| 强制浏览器核心（认证门、`socClient`、策略 schema、管理页回退） | `packages/soc-agent-client` |
| 隔离侧栏与工作区浏览/选择器 | `packages/soc-agent-sidebar`、`packages/soc-agent-workspace` |
| 可选浏览器功能（品牌、管理、动作策略、附件、邮件草稿） | `packages/soc-agent-brand`、`packages/soc-agent-admin`、`packages/soc-agent-action-policy`、`packages/soc-agent-attachments`、`packages/soc-agent-email-draft` |
| 28 个域工具（Zimbra 22 含转发草稿，订阅 6） | `apps/soc-agent/server/unified_mcp_server/` |
| 13 个只读 Splunk 工具（外部端点；必配） | `apps/soc-agent/splunk-bridge.js` |
| 认证、归属权隔离、事件脱敏 | `apps/soc-agent/auth-host.js`、`ownership.js` |
| 工具允许列表 + 动作策略 | `apps/soc-agent/tool-inventory.js`、`policy.js`、`host.js` |
| 管理控制台（状态、上下文、审批、提供商） | `AdminConsole.tsx`（`/admin`） |
| 技能（操作手册） | `skills/*/SKILL.md` |
| 安装/更新工具 | `setup.sh`、`update.sh` |

## 7. 安全哲学（及其执行位置）

1. **先允许列表，再分类。** 工具必须同时被补丁允许列表注册*并*通过宿主策略；未知名称一律拒绝（`host.js tools/pre-execute`）。
2. **服务端身份。** 每个请求携带服务端验证过的身份；提示词与检索内容无法改变你是谁。
3. **两层审批。** MCP 侧门控（如 `ZIMBRA_ALLOW_SEND`、过滤规则指纹）与界面侧审批状态必须同时满足；任何一侧都可以说不。
4. **邮件由人发送。** 唯一投递路径要求已认证会话、发送门控、界面显式确认，以及 Zimbra 自己的 `sent: true` 回执。
5. **一切有界。** 时间预算（180 秒）、输出上限（Splunk 投影 50 KB、背景 64 KiB、附件字节/字符限额）、线程池配额。
6. **证据而非指令。** 邮件与 Splunk 内容是数据；`AGENTS.md` 相应约束模型，系统也从不把检索内容当作授权。

细节与残余风险: [SECURITY_AND_TRUST_BOUNDARIES.md](SECURITY_AND_TRUST_BOUNDARIES.md)。

## 8. 现有能力 vs 历史材料

- **当前：** 本核对提交上的上述全部能力。
- **历史/已移除：** 进程内 Splunk 实现本轮已删除（记录于 `docs/SHORTENING_PLAN_IMPLEMENTATION.md`）；遗留存储账户功能仍被管理 CLI 拒绝；`integrations/` 目录早已被桥接方案取代。
- **愿景性漂移：** `AGENTS.md` 列出的三个技能（`soc-incident-triage`、`email-to-splunk-investigation`、`zimbra-operations`）在 `skills/` 中没有文件，且 `detection-engineering`/`spl-writing` 引用的工具本轮已被移除。见 [DOCUMENTATION_AUDIT.md](DOCUMENTATION_AUDIT.md)。

## 仓库中的证据

- 工作流与边界：根目录 `AGENTS.md`、`BACKGROUND.md`、`skills/*/SKILL.md`
- 执行：`apps/soc-agent/tool-inventory.js`、`policy.js`、`host.js`、`splunk-bridge.js`、`unified_mcp_server/server.py`
- 非目标：`test_server_tools.py`（无 Splunk 工具）、`admin_cli.py`（拒绝项）、`cordis.patch.yml`（禁用的工具族）、`docs/SHORTENING_PLAN_IMPLEMENTATION.md`（移除记录）

## 未知项

- 外部官方 Splunk MCP 服务器的确切防护措施定义在本仓库之外（本文只描述本仓库如何消费它）。
- 订阅服务的数据模型由其 API 响应（`get_subscription_schema`）定义，不在本仓库中。
