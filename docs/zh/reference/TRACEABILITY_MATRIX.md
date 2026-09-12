# 可追溯矩阵（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12（第二轮；Splunk 栈移除重构后逐行重核）。
> 语言 / Language: **中文** · [English](../../reference/TRACEABILITY_MATRIX.md)

**本页读者:** 安全评审者与未来维护者。任何代码变更后，下表是找出可能失效文档的最快途径。

置信图例: **已确认**（源码 + 测试断言）、**推断**（源码强支持、无专门测试）、**未知**（证据缺失 — 见审计）。运行状态: 活跃 / 条件性 / 仅管理员 / 已移除 / 生成 / 遗留。

| # | 论断 | 源码路径 · 符号 | 守护测试 | 解释于 | 置信 | 运行状态 |
|---|---|---|---|---|---|---|
| 1 | `soc_agent` 恰暴露 28 个 Zimbra+订阅工具（含 `zimbra_forward_email`） | `cordis.patch.yml` `allowedToolNames`（28）；`server.py`（3 个 `register_tools` 调用） | `test_server_tools.py`（`len == 28` + 转发 schema）；`skills.test.js` | [MCP_TOOL_CATALOG](MCP_TOOL_CATALOG.md)、[MCP_AND_TOOL_ROUTING](../MCP_AND_TOOL_ROUTING.md) | 已确认 | 活跃 |
| 2 | 工具清单单一来源于 `tool-inventory.js`，策略与桥接共同消费 | `tool-inventory.js`；两处 import | `policy.test.js`；`skills.test.js` | [MCP_TOOL_CATALOG](MCP_TOOL_CATALOG.md) | 已确认 | 活跃 |
| 3 | `splunk_mcp` 是连外部端点的客户端桥，13 读工具，缺端点+令牌即禁用；端点 URL 被校验 | `splunk-bridge.js` | `splunk-bridge.test.js`（4） | [COMPONENT_CATALOG](COMPONENT_CATALOG.md) §8 | 已确认 | 条件性 |
| 4 | 全限定名 = `mcp__<server>__<tool>`；`splunk` 可在两段出现 | `tool-inventory.js` 派生 | `policy.test.js` | [MCP_AND_TOOL_ROUTING](../MCP_AND_TOOL_ROUTING.md) | 已确认 | 活跃 |
| 5 | `zimbra_send_email` 与 `zimbra_forward_email` 只建本地草稿，从不发送/持久化 | 两个工具的 docstring；`create_email_draft`/`create_forward_draft` | `test_zimbra_service.py`；`test_server_tools.py` | [MCP_TOOL_CATALOG](MCP_TOOL_CATALOG.md)、[RUNTIME_FLOWS](../RUNTIME_FLOWS.md) 流程 8 | 已确认 | 活跃 |
| 6 | 转发投递复用人工确认的发送路径，携带 `forward_message_id` | `mail/service.py send_email`；`auth_cli.py`；`zimbra.py zimbra_forward_message` | `test_zimbra_service.py`；客户端转发测试 | [MCP_TOOL_CATALOG](MCP_TOOL_CATALOG.md) §6 | 已确认 | 活跃 |
| 7 | 邮件投递仅经 UI 确认 RPC；界面要求 `window.confirm` 与 `sent === true` | `EmailDraftToolview.tsx`；`auth_cli.py send-email`（门 `ZIMBRA_ALLOW_SEND`） | `email-draft-toolview.test.ts`；`sections.test.ts` | [USER_INTERFACE_AND_ACTION_MODES](../USER_INTERFACE_AND_ACTION_MODES.md) | 已确认（确认对话框本身是界面级控制） | 活跃 |
| 8 | 宿主策略拒绝 `DOMAIN_TOOLS ∪ CONTROL_TOOLS` 之外的一切 | `host.js` `tools/pre-execute` | `policy.test.js` | [SECURITY_AND_TRUST_BOUNDARIES](../SECURITY_AND_TRUST_BOUNDARIES.md) | 已确认 | 活跃 |
| 9 | 策略集现为 30 只读 / 42 域 / 12 审批，从清单派生 | `policy.js` | `policy.test.js`（逐字） | [MCP_TOOL_CATALOG](MCP_TOOL_CATALOG.md) | 已确认 | 活跃 |
| 10 | Full access 运行每个被允许工具；SOC mode 遵循每工具状态；模式不扩大允许列表 | `host.js` 状态解析 | `policy.test.js`；`user-mode.test.js` | [USER_INTERFACE_AND_ACTION_MODES](../USER_INTERFACE_AND_ACTION_MODES.md) | 已确认 | 活跃 |
| 11 | 部署策略存于设置 `soc-action-approval`；会话覆盖在内存、登出即撤销 | `action-approval-settings.ts`；`ownership.js setActionMode` | `user-mode.test.js`；`action-policy.test.ts` | [AUTHENTICATION_AND_OWNERSHIP](../AUTHENTICATION_AND_OWNERSHIP.md) | 已确认 | 活跃 |
| 12 | 服务端身份权威；拒绝 `account_id` 选择 | `server.py fresh_runtime`；`zimbra/core/service.py resolve_account`；`_EmptyAccountStore` | `test_zimbra_service.py`；`test_server_tools.py` | [AUTHENTICATION_AND_OWNERSHIP](../AUTHENTICATION_AND_OWNERSHIP.md) | 已确认 | 活跃 |
| 13 | 登录经 Python 由 Zimbra 验证；会话 24 h、令牌加密；单设备替换 | `ownership.js`；`auth_cli.py login`；`postgres_store.py create_user_session` | `test_auth.py`；`auth.test.js` | [AUTHENTICATION_AND_OWNERSHIP](../AUTHENTICATION_AND_OWNERSHIP.md) | 已确认 | 活跃 |
| 14 | 管理员认证: 静态环境凭据、8 h 内存哈希会话、时间安全比较 | `ownership.js` | `auth.test.js` | 同上 | 已确认 | 活跃 |
| 15 | IDOR 防护: 受限 API 代理；工作区限于 `.data/soc-workspaces/<userId>/` | `ownership.js createScopedApiProxy`、`isWithinPath` | `auth.test.js` | 同上 | 已确认 | 活跃 |
| 16 | 事件流按用户过滤/脱敏 | `ownership.js filterFrame` | `auth.test.js` | 同上 | 已确认 | 活跃 |
| 17 | MCP 请求携带认证元数据；`soc_deadline_ms` = now+180 s | `auth-host.js`；`server.py` | `auth.test.js`；`user-mode.test.js` | [MCP_AND_TOOL_ROUTING](../MCP_AND_TOOL_ROUTING.md) | 已确认 | 活跃 |
| 18 | 每 MCP 操作 180 秒预算；线程池 8 全局 / 2 每主体 | `request_context.py`；`blocking_io.py` | `test_zimbra_service.py`（限额） | [ARCHITECTURE](../ARCHITECTURE.md) | 已确认 | 活跃 |
| 19 | Python Splunk 栈**已移除**（原"保留"） | 本轮删除；`pyproject.toml` 无 `splunk.*` 包 | `test_server_tools.py`（无 `splunk_*`）；`git ls-files` 缺席 | [REPOSITORY_MAP](REPOSITORY_MAP.md)、[COMPONENT_CATALOG](COMPONENT_CATALOG.md) §13 | 已确认 | 已移除 |
| 20 | 管理 `test-splunk` = 实时桥接探测（`splunk_get_info`），非 REST 检查 | `host.js`、`splunk-bridge.js`；`admin_cli.py`（命令已删） | `splunk-bridge.test.js` "admin connection check…" | [COMPONENT_CATALOG](COMPONENT_CATALOG.md) §11 | 已确认 | 仅管理员 |
| 21 | 官方 Splunk 输出进入模型前脱敏（卡/SSN）并截断 50 KB | `investigation.js` | `investigation.test.js` | [SECURITY_AND_TRUST_BOUNDARIES](../SECURITY_AND_TRUST_BOUNDARIES.md) | 已确认 | 活跃 |
| 22 | BACKGROUND.md 注入并每 N（默认 5）个用户提示刷新；64 KiB 渲染上限 | `host.js installBackgroundRefresh` | `background.test.js` | [RUNTIME_FLOWS](../RUNTIME_FLOWS.md) 流程 13 | 已确认 | 活跃 |
| 23 | 补丁禁用模型可见 shell/fs/子代理工具；审批 `policy: ask`；技能目录受限 | `cordis.patch.yml` | `skills.test.js` | [SECURITY_AND_TRUST_BOUNDARIES](../SECURITY_AND_TRUST_BOUNDARIES.md) | 已确认 | 活跃 |
| 24 | 控制通道: 常驻 Python 进程、JSON 行、丢响应不重放 | `ownership.js`；`control_server.py` | `control-channel.test.js`；`test_control_server.py` | [INTERFACE_CATALOG](INTERFACE_CATALOG.md) §5 | 已确认 | 活跃 |
| 25 | 附件转换有界（默认 10 MB/200 k，硬顶 100 MB/2 M）、全内存、LRU 缓存 | `attachment_converter.py`；客户端 schema | `test_zimbra_service.py`；`markitdownAttachments.test.ts` | [RUNTIME_FLOWS](../RUNTIME_FLOWS.md) 流程 12 | 已确认 | 活跃 |
| 26 | 过滤器写入按指纹门控；redirect/discard 单独门控 | `zimbra/filters/service.py` | `test_zimbra_filters.py` | [MCP_TOOL_CATALOG](MCP_TOOL_CATALOG.md) §2 | 已确认 | 活跃 |
| 27 | 订阅客户端: 表单登录、401 恰一次重认证、重定向校验、错误体不外泄 | `email/service.py` | `test_email_service.py` | [COMPONENT_CATALOG](COMPONENT_CATALOG.md) §7 | 已确认 | 条件性 |
| 28 | 数据库 Schema 由版本化 SQL 迁移拥有（advisory 锁；台账表；URI 走 stdin） | `schema.py`、`migrations/*.sql`、`ownership.js ensureSchema`、`admin_cli.py migrate` | `test_schema.py`（3） | [DATA_STORE_CATALOG](DATA_STORE_CATALOG.md) §1 | 已确认 | 活跃 |
| 29 | `lib/` 是被跟踪生成产物；本轮已重建 | `tsdown.config.ts`；`setup.sh` 漂移检查 | 无自动化（setup 时检查） | [REPOSITORY_MAP](REPOSITORY_MAP.md) §4 | 已确认 | 生成 |
| 30 | setup 要求官方 MCP 连接；参数清单单一来源；REST Splunk 字段移除 | `setup.sh`（+ README 论断）、`.env.example` | `setup.test.js`（5） | [GETTING_STARTED](../GETTING_STARTED.md)、[DEPLOYMENT_AND_OPERATIONS](../DEPLOYMENT_AND_OPERATIONS.md) | 已确认 | 运维工具 |
| 31 | 仓库根无 CI；测试手动运行 | 仓库树 | — | [TESTING](../TESTING.md) | 已确认 | — |
| 32 | `AGENTS.md` 列 3 个无 `SKILL.md` 的技能 | `AGENTS.md` vs `skills/` | — | [DOCUMENTATION_AUDIT](../DOCUMENTATION_AUDIT.md) | 已确认（漂移） | — |
| 33 | 检测/SPL 技能引用**本轮已移除**的工具 | 技能文件 vs 删除 | — | [MCP_TOOL_CATALOG](MCP_TOOL_CATALOG.md) §7、[DOCUMENTATION_AUDIT](../DOCUMENTATION_AUDIT.md) | 已确认（漂移，加重） | — |
| 34 | Send 确认是否有超出认证 + `ZIMBRA_ALLOW_SEND` 的服务端强制 | `auth_cli.py send-email`、`ownership.js` | — | [USER_INTERFACE_AND_ACTION_MODES](../USER_INTERFACE_AND_ACTION_MODES.md) | 推断: 确认是界面级；服务端强制会话认证 + 门 + `sent:true` 校验 | 活跃 |
| 35 | vendor 以含外层仓库的工作区钉扎；apiproxy 错误码钉入上游 | `pnpm-workspace.yaml`；`rpc.schema.ts` | vendored 测试；`auth.test.js` | [REPOSITORY_MAP](REPOSITORY_MAP.md) §7 | 已确认 | vendored |
| 36 | `hi.txt` 已删除；`soc-agent-scheduler` 问题仍开放 | 本轮删除；`git ls-files` | — | [DOCUMENTATION_AUDIT](../DOCUMENTATION_AUDIT.md) §8 | 已确认 | 已移除 |
