# MCP 与工具路由（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../MCP_AND_TOOL_ROUTING.md)。完整工具表: [reference/MCP_TOOL_CATALOG.md](reference/MCP_TOOL_CATALOG.md)。

**本页读者:** 曾被这里的工具名搞糊涂过的人 — 考虑到这些命名，迟早人人都会。

**读完后你将了解:** MCP 在本仓库的角色、工具名在每层如何构造与校验、`soc_agent` 与 `splunk_mcp` 为何是两个服务器、名字为何会重复产品词、哪些名字根本不是工具，以及测试如何防止各清单漂移。

**通俗概述。** 模型只能调用闯过三道过滤的工具：每个 MCP 服务器的原始允许列表（补丁中）、agent 的受限工具集、以及宿主的精确名策略门。读工具自动执行；12 个变更动作需要审批；邮件投递根本不是工具。Splunk 工具经客户端桥接来自外部服务器；Zimbra/订阅工具来自一个以登录用户身份执行的本地 Python 服务器。

**前置要求:** [ARCHITECTURE.md](ARCHITECTURE.md) §2。完整表格: [reference/MCP_TOOL_CATALOG.md](reference/MCP_TOOL_CATALOG.md)。

---

## 1. MCP 的角色（通俗版）

MCP（Model Context Protocol）是 harness 给模型接入工具的方式。*服务器*暴露*工具*；harness 的 MCP *客户端*连接服务器并把工具注册到模型工具列表。本仓库只有两条连接，且不对称：

| | `soc_agent` | `splunk_mcp` |
|---|---|---|
| 是什么 | 本地 Python MCP **服务器**（FastMCP），stdio 子进程 | 连接外部官方 Splunk MCP 服务器的**客户端桥接**（`splunk-bridge.js`） |
| 代码位置 | `apps/soc-agent/server/unified_mcp_server/` | `apps/soc-agent/splunk-bridge.js`（仅客户端） |
| 传输 | stdio（`uv run unified-mcp-server`） | streamable HTTP + `Authorization: Bearer` |
| 工具 | 28 个（Zimbra 邮件/过滤 + 订阅） | 13 个只读工具 |
| 身份 | 登录用户（Postgres 会话 → 其 Zimbra 令牌） | 环境中的服务令牌 |
| 失败模式 | 拉起失败即致命（`failOnStartupError: true`） | 端点/令牌缺失时静默禁用；其余按调用报错 |
| 防护 | 本地信封 + 校验；上游 Zimbra | **远端**服务器侧防护；本地事后投影 |

## 2. 命名解剖

**全限定名** = `mcp__<服务器名>__<原始工具名>`。

```
mcp__ splunk_mcp __ splunk_run_query
└宿主┘ └─服务器─┘  └────原始工具────┘
```

- `mcp__` 前缀由 harness 客户端注册时添加。
- `splunk_run_query` 是外部服务器暴露的原始名；`splunk_mcp` 是桥接声明的命名空间（`serverName: 'splunk_mcp'`）。`splunk` 一词出现两次 = 同一个产品词用在两个不同层 — 不代表两个服务器。
- **三层标识符**（最易混淆）：cordis *插件 id*（`splunk-official-mcp`）、*插件包名*（`dsh-soc-agent/splunk-bridge`）、*MCP 服务器命名空间*（`splunk_mcp`）。Python 服务器同理：`soc-agent-mcp` → `@deepseek-ai/dsh-mcp-client`（实例）→ `soc_agent`。

### 不是 MCP 工具的名字形态

| 形态 | 例 | 是什么 |
|---|---|---|
| `ui__<服务器>__<动作>` | `ui__soc_agent__send_email` | `TOOL_CATALOG` 中的 UI 确认型条目（管理清单中的"显式确认"）。是*标签*，指向人工发送路径；模型永远调不到 |
| 无前缀宿主工具 | `skill` | harness 的技能加载工具，在 `READ_ONLY_TOOLS` 中；属于 `DOMAIN_TOOLS` |
| harness 交互工具 | `ask_user_question`、`exit_plan_mode` | 经 `host.js` `CONTROL_TOOLS` 与 `DOMAIN_TOOLS` 一并允许 |

### 名字 vs 行为陷阱（务必记住）

1. **`zimbra_send_email` 不发信。** 它构建本地草稿（docstring: "Build a local draft without contacting or writing to Zimbra"），被分类为*只读*，UI 标签是 "Create email draft"。实际投递 = 草稿视图 → `window.confirm` → `send-email` 宿主 RPC → 控制通道 → `ZimbraMailService.send_email`（门控 `ZIMBRA_ALLOW_SEND`）。模型没有任何可调用的发信工具。
2. **`zimbra_forward_email` 同样只出草稿**（本轮新增）：读取原信，内嵌 `forward_message_id` 与 `forwarded_message` 元数据；投递仍走确认后的发送路径 — 这次会带上原信与附件。
3. **`zimbra_use_signature_on_email` 也不发送** — 它产出合并签名后的可编辑草稿。
4. **`preview_subscription` 与 `validate_email_filter` 是只读工具** — 计算拟议变更而不写入。
5. **技能引用已移除的工具。** `detection-engineering`/`spl-writing`（及 `false-positive-analysis` 部分）提到的 `splunk_get_detection`、`splunk_compile_citic_detection`、`splunk_backtest_detection`、`splunk_validate_detection`、`splunk_search` — 其实现代码本轮已**删除**。见 [DOCUMENTATION_AUDIT.md](DOCUMENTATION_AUDIT.md)。

## 3. 路由层（谁在哪一步检查）

可交互图见英文站 [site/mcp-tooling.html](../site/mcp-tooling.html)；可编辑源: [diagrams/mcp-routing.mmd](../diagrams/mcp-routing.mmd)。

1. **注册（原始允许列表）。** `cordis.patch.yml` 给每个服务器 `allowedToolNames`：`soc_agent` 精确 28 个；桥接只暴露 `OFFICIAL_SPLUNK_TOOL_NAMES`（13）。`dsh-mcp-client` 不注册清单之外的名字（`mcp-discovery.test.js`）。
2. **限制（agent 工具集）。** `agent/created` 时 `host.js` 调用 `tools.restrict({allow: [...DOMAIN_TOOLS, ...CONTROL_TOOLS]})` — 尽力而为，因为 MCP 工具可能仍在注册。
3. **执行（权威门）。** `tools/pre-execute`（全局）：精确字符串属于 `DOMAIN_TOOLS ∪ CONTROL_TOOLS` 否则拒绝（"This harness exposes only approved Splunk, Zimbra, and subscription tools."）。随后模式/状态：`full` → 全部放行；`soc` → 每工具 `ask|auto|disabled`（默认：变更 `ask`、读取 `auto`）。`ask` 裁决进入 harness 审批瀑布（fail-closed — 无应答即拒绝）。
4. **身份元数据。** 对两个服务器名，`mcp/request-meta` 附加 `soc_session_id`、`soc_investigation_id`、`soc_customer_id`（恒空）、`soc_correlation_id`、`soc_deadline_ms`（now + 180 秒）。空客户 id 故意*不是*选择器 — 身份只在服务端。
5. **输出边界。** `tools/post-execute`（投影）只作用于 `mcp__splunk_mcp__splunk_*`；`soc_agent` 的结果一律走信封整形。

## 4. 只读 vs 变更分类

- **只读（`READ_ONLY_TOOLS`，30）：** `skill` + 13 个 Splunk 读 + 13 个 Zimbra 邮件工具*按读取注册*（两个草稿构建器与转发草稿不写任何东西）+ 4 个过滤读取/校验 + 3 个订阅读。注意微妙处：`zimbra_send_email` 与 `zimbra_forward_email` 位于只读列表**因为它们不写** — 说出真相的是标签而非名字。
- **变更（`ACTION_CATALOG`，12）：** Zimbra `move_email`、建文件夹、建/删签名、五个过滤写、三个订阅写。全部默认 `ask`；Python 侧另有环境门（`ZIMBRA_ALLOW_*`）与（过滤器的）`expected_fingerprint` 乐观并发。
- **`APPROVAL_TOOLS` = `ACTION_TOOLS`**，`ALWAYS_ASK_ACTION_TOOLS` 为空 — 管理端 "Access & approvals" 的每工具状态映射是唯一可覆盖默认值的地方。
- **UI 确认：** `ui__soc_agent__send_email` 渲染为 "Explicit confirmation" 徽章，不可自动化。

## 5. 输出投影与呈现

- Splunk 结果在进入模型上下文前被投影（掩码卡号/SSN；截断 50 KB 并带可见标记）— [RUNTIME_FLOWS.md](RUNTIME_FLOWS.md) 流程 14。
- 草稿工具结果由 `EmailDraftToolview`（同时键于两个草稿工具与转发工具）渲染为可编辑卡片，而非原始 JSON。
- 其余结果按 harness 工具视图渲染。

## 6. 测试如何防止命名与清单回归

| 漂移风险 | 守卫 |
|---|---|
| Python 服务器注册 28 个之外的东西 | `test_server_tools.py`（`len(tools) == 28`；也禁止 `ctx`/`account_id` 参数） |
| 补丁允许列表 ≠ Python 面 | `skills.test.js` 钉住补丁的 28 名单；JS 与 Python 独立钉住**同一**名单 |
| 桥接允许列表混入写工具 | `splunk-bridge.test.js` + `skills.test.js` 断言无 `splunk_(create|update|delete|write)_` 且读名单精确 |
| 策略集合偏离清单 | `policy.test.js` 钉住 30/42/12；`ACTION_TOOLS` 从 `ACTION_CATALOG` 派生（构造上单一事实源），且两者都派生自 `tool-inventory.js` |
| 客户端自造模式或绕过端点 | `action-policy.test.ts`（精确 RPC 三元组；失败关闭） |
| vendored 客户端改变允许列表语义 | `mcp-discovery.test.js` |

**安全地改一个工具：** 六合同步清单见 [DEVELOPMENT.md](DEVELOPMENT.md) §"新增或修改工具"。
