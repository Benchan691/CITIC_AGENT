# 测试覆盖矩阵（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../../reference/TEST_COVERAGE_MATRIX.md)。
> 当前来源: `apps/soc-agent/tests/`（**12 文件 42 测试**）与 `unified_mcp_server/tests/`（**10 测试文件 + `__init__.py`，48 测试**）。当前工作树还包含强制核心、隔离表面、六个可选浏览器包的包内测试，以及浏览器 smoke/screenshot 测试。上一轮（`b26d55d`）为 27/9/75 — Python 的缩减是被删 Splunk 栈带走了它自己的测试，不是活跃代码 coverage 的损失。

**本页读者:** 改动行为的开发者（哪些测试须随行）、判断论断证据的评审者。

**如何运行:** 见 [TESTING.md](../TESTING.md)。全部离线运行。无 skip。

---

## 1. Node 测试 — `apps/soc-agent/tests`（11 文件 / 42 测试）

| 文件 | 数 | 覆盖行为 |
|---|---|---|
| `auth.test.js` | 10 | 管理员凭据启动必需且不泄漏；管理员 Cookie 登录/过期/登出 + 重启失效；会话撤销中断事件流并栅栏 MCP 工作；Cookie 分层；受限 API 阻断跨用户变更（IDOR）；工作区路径校验/穿越拒绝；事件帧脱敏；挂起响应 RPC id 防劫持；传输门控；`mcp/request-meta` 元数据不含令牌材料 |
| `background.test.js` | 1 | BACKGROUND.md 再注入节奏（默认 5 个持久提示）、放置、实时阈值、`0` 禁用 |
| `control-channel.test.js` | 2 | 并发控制请求共享一个 Python 进程；传输后丢响应 → `operation_outcome_unknown` 且**无** CLI 兜底重放 |
| `investigation.test.js` | 1 | 卡号/SSN 掩码只作用于 `mcp__splunk_mcp__*` 输出 |
| `mcp-discovery.test.js` | 1 | `allowedToolNames` 在 stdio 与 streamable-http 下对 undefined/`[]`/显式列表的往返 |
| `policy.test.js` | 4 | 精确产品工具集（**30/42/12** 逐字钉扎）；pre-execute 裁决；SOC 模式部署状态 + RPC 契约；Full access 绕过每工具状态 |
| `python-command.test.js` | 1 | 新: `runPythonCommand` 拉起/超时/中止/解析契约（子环境剔除管理凭据） |
| `setup.test.js` | 5 | 新: setup doctor 参数清单与校验逻辑（官方 MCP 端点+令牌必填；明文 HTTP 选择规则） |
| `skills.test.js` | 5 | 补丁启用技能/计划层；citic-soc 预设指令候选（BACKGROUND.md 恰一次）+ 技能内容断言；补丁禁用原生 shell/权限工具；桥接只接线读工具；`soc_agent` 允许列表 = 精确 **28** 名单且无 `splunk_` |
| `splunk-bridge.test.js` | 4 | 桥接读部署配置、转发 Bearer、允许列表 = 13 读名；TLS 默认校验；**新:** 配置要求 MCP 凭据与显式明文 HTTP 选择（端点 URL 校验）；**新:** 管理连接检查使用活跃允许工具（`splunk_get_info`）并保留授权、错误脱敏与取消 |
| `user-mode.test.js` | 1 | 动作模式已认证、按会话隔离、被强制（`full` 放行、`soc` 询问）、登出撤销 |

## 2. SOC 浏览器包测试 — `packages/soc-agent-*/tests`

| 包 | 数 | 覆盖行为 |
|---|---|---|
| `soc-agent-client` | 5 | 核心 `SocClientRuntime`、`/admin` 路由、RPC 转发/错误处理、强制 action-policy schema、认证/回退归属与无可选 UI 导入 |
| `soc-agent-sidebar` | 27 | 展开/收起、root owner、标准子槽位、品牌/工作区/设置/footer 互操作、固定 CSS/DOM 不变量 |
| `soc-agent-workspace` | 149 | 工作区浏览/选择器、搜索/分组/tree/重排、逻辑工作区创建、创建/删除/改名/fork/archive/会话删除、General 清空、挂起/错误状态、可恢复 folders 守卫 |
| `soc-agent-brand` | 2 | 侧栏与 conversation branding 贡献 |
| `soc-agent-admin` | 4 | 管理状态、凭据护栏、访问策略护栏、核心子槽位挂载 |
| `soc-agent-action-policy` | 3 | `readActionMode` 精确 RPC、畸形/失败响应拒绝、采纳服务端确认模式 |
| `soc-agent-attachments` | 1 | 双 worker 转换、保序、重试、缓存、截断注记、`release()` 清理 |
| `soc-agent-email-draft` | 3 | 收件人解析/去重、规范草稿字段、转发字段映射、签名/发送视图行为 |
| `soc-agent-auto-collapse` | 3 | 原生 Chat 契约接线、`dsh-auto-collapse` 持久设置读取、状态文案、监听器清理与可安全 teardown 的 service 生命周期 |

36 个 SOC 包加产品 bundle 由根 workspace 构建；其中 26 个包面产生独立、被跟踪的浏览器产物。测试通过 rc.2 兼容 loader 导入源码；应用装配测试另外递归扫描第一方源码/清单，确保没有被替代官方实现的导入。

## 3. Python 测试 — `unified_mcp_server/tests`（10 文件 / 48 测试）

| 文件 | 数 | 覆盖行为 |
|---|---|---|
| `test_server_tools.py` | 1 | **精确 28 工具面**（含 `zimbra_forward_email` 的参数/必填/`readOnlyHint`）；无 `splunk_*`/`catalog_*`/`scheduled_task_*`/`system_get_status`；无 `ctx`/`account_id` 参数；逐工具 schema |
| `test_schema.py` | 3 | 新: 迁移运行器 — 有序应用、`soc_schema_migrations` 台账（不重复应用）、advisory 锁序列化 |
| `test_auth.py` | 4 | Postgres 上的会话生命周期: 规范化用户创建、不暴露密码/令牌、24 h 过期、登出、上游令牌失效 |
| `test_config.py` | 7 | 未配置时安全默认；env-only 来源；`public_status` 脱敏**含 `official_mcp_enabled`**；拒绝带凭据端点；精简 Splunk 设置形状 |
| `test_zimbra_service.py` | 14 | 元数据/正文分离；联网前查询校验；身份绑定令牌 + 拒绝账户选择；门控+校验的移动；仅本地草稿；**转发草稿**（`create_forward_draft` — 本地、内嵌元数据）；发送路径含 `forward_message_id`；签名门 |
| `test_zimbra_filters.py` | 4 | 预览 diff/指纹门；写门；redirect/discard 门；并发修改拒绝 |
| `test_email_service.py` | 3 | 订阅客户端: 每批一次登录、401 恰好一次重认证、拒绝不安全重定向 |
| `test_control_server.py` | 1 | 控制通道行协议 + 真实子进程端到端 |
| `test_postgres_store.py` | 1 | 加密值的配置/账户往返 |
| `test_account_store.py` | 1 | 本地账户存储静态加密 |

**随 Splunk 栈移除的测试**（其对象已不存在）: `test_citic_compiler.py`、`test_citic_format.py`、`test_official_splunk_mcp_client.py`、`test_search_evidence.py`、`test_security_queue.py`、`test_splunk_guardrails.py`、`test_splunk_jobs.py`、`test_splunk_lookup.py`、`test_splunk_query_policy.py`、`test_splunk_resource_governance.py`、`test_splunk_search_planning.py`、`test_splunk_service.py`、`citic_fixtures.py`。

## 4. 命名/允许列表回归护栏（漂移栅栏）

| 不变量 | 守护测试 |
|---|---|
| Python 服务器恰暴露 28 个允许列表工具 | `test_server_tools.py` ↔ `skills.test.js`（同 28 名单） |
| 策略集合从 `tool-inventory.js` 精确派生（30/42/12） | `policy.test.js` — 清单现在是**结构性**栅栏（policy 与桥接都导入它） |
| 桥接允许列表只读且与清单一致 | `splunk-bridge.test.js` ↔ `skills.test.js` |
| 桥接端点/凭据配置被校验 | `splunk-bridge.test.js` "official configuration requires MCP credentials…" |
| vendored 客户端的 `allowedToolNames` 语义保留 | `mcp-discovery.test.js` |
| 客户端只用授权策略 RPC 且失败关闭 | `soc-agent-action-policy/tests/action-policy.test.ts` |
| 管理控制台不能绕过只写凭据或脱离 `/admin` 核心子槽位挂载 | `soc-agent-admin/tests/sections.test.ts` |
| 核心拥有 admin root 并提供安全回退 | `soc-agent-client/tests/core-contract.test.ts`、`soc-agent-admin/tests/sections.test.ts` |
| 官方侧栏/工作区被禁用且第一方代码不导入 | `apps/soc-agent/tests/sidebar-workspace.test.js` |
| fixture 浏览器加载无 loader/console/请求错误 | `apps/soc-agent/tests/browser-smoke.test.mjs` |
| setup 参数清单强制官方 MCP 连接 | `setup.test.js` |

## 5. 已知覆盖缺口（缺口，非已证缺陷）

1. 浏览器 smoke/screenshot 使用 fixture 数据并仅拦截认证；不覆盖真实 Zimbra、Splunk、订阅或 PostgreSQL 行为。
2. **转发端到端**（`zimbra_forward_email` → 草稿卡 → `send-email` RPC → `zimbra_forward_message` 投递）分段测试，未做一体化。
3. **Postgres 路径**用内存 SQL 替身；迁移运行器有直接测试但未在无 CI 环境对真库执行。
4. **`setup.sh` 行为**由 `--plugins`/`--check` 验证与参数清单测试覆盖，但没有为每种 profile 状态提供 hermetic CI fixture。
5. **仓库根无 CI** — 套件需手动运行。
6. **引用已移除工具的技能**（`detection-engineering`、`spl-writing`、`false-positive-analysis` 部分）有内容断言，但其工作流当前无法执行其命名工具。
