# 测试（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../TESTING.md)。逐文件细节: [reference/TEST_COVERAGE_MATRIX.md](../reference/TEST_COVERAGE_MATRIX.md)。

**本页读者:** 运行或扩展测试套件的开发者、判断哪些论断有测试证据的评审者。

**读完后你将了解:** 三个测试层及各自的运行方式、每个测试文件断言什么、涉及的前置条件与夹具、守护命名/允许列表契约的测试，以及刻意较薄的覆盖处。

**通俗概述。** 三个套件 — Node（11 文件 35 测试）、TypeScript（5 文件 12 测试）、Python（10 文件 39 测试）— 全部可离线运行（内存替身、假传输、本地子进程）。从不需要活的 Splunk/Zimbra/Postgres，没有 skip，并且有一组测试专门防止工具清单漂移。Python 套件本轮缩小是因为被移除的 Splunk 栈带走了它自己的测试。

**前置要求:** 依赖已安装（`./setup.sh --plugins` 或各套件 `uv sync`）。

---

## 1. 分层与命令

| 层 | 位置 | 命令 | 运行器 |
|---|---|---|---|
| 宿主（JS） | `apps/soc-agent/tests/` | `npm test`（在该目录） | `node --test` |
| 客户端（TS） | `packages/soc-agent-client/tests/` | `npm test`（在该目录） | `node --test` + vendored tsx 加载器 |
| 服务器（Python） | `apps/soc-agent/server/unified_mcp_server/tests/` | `uv run pytest`（先 `uv sync --extra test`） | pytest，`asyncio_mode=auto`，`-q` |

仓库根**没有**统一测试入口，也**没有 CI 配置** — 手动运行各套件（见 [DEVELOPMENT.md](DEVELOPMENT.md) 与 [SECURITY_AND_TRUST_BOUNDARIES.md](SECURITY_AND_TRUST_BOUNDARIES.md) 的残余风险注记）。

## 2. 各套件证明什么（要点）

- **宿主 JS** — 安全关键契约：管理员凭据启动要求、Cookie/会话生命周期、Cookie 分层、受限 API 代理（IDOR）、工作区路径包含性、事件脱敏、背景刷新节奏、精确工具策略裁决（**30 读 / 42 域 / 12 审批**）、Full-access 只绕状态不绕允许列表、控制通道不重放语义、Splunk 投影限域、桥接配置/TLS/URL 校验、补丁↔桥接↔策略命名钉扎、`python-command.js` 运行器契约、setup 参数清单。
- **客户端 TS** — 失败关闭的动作模式 RPC 契约、草稿字段规范化（含**转发字段**）、双 worker 转换控制器（顺序、缓存、重试）、管理控制台源码护栏（挂载门控、只写凭据、无遗留卡、无直接 settings RPC）。
- **Python** — 精确 28 工具面（且无 `splunk_*`/遗留工具）、会话生命周期与脱敏、配置校验/脱敏、Zimbra 服务/过滤器语义（指纹并发、门控、带校验的移动、仅本地草稿、**转发草稿**）、订阅客户端边界、附件限额、控制服务器协议（真实子进程）、迁移运行器（`test_schema.py`）。

## 3. 前置、夹具、模拟

| 关注点 | 实情 |
|---|---|
| 活服务 | **无。** 没有测试连接 Splunk/Zimbra/Postgres/订阅端点。任何套件都没有 skip 标记 |
| Postgres 替身 | 内存 SQL 替身（`test_auth.py` 的 `SocConnection`、`test_postgres_store.py` 的 `FakeConnection`） |
| HTTP 替身 | 假 `httpx` 传输（订阅、Splunk 客户端） |
| Python 子进程 | `test_control_server.py` 拉起真实控制服务器；`test_schema.py` 直接测迁移运行器 |
| 认证夹具 | 临时目录 + 夹具 `.env`（`SOC_ADMIN_EMAIL=admin@example.com`、占位密码）；`MCP_SERVER_ROOT` 设置后恢复 |
| Splunk 夹具 | `https://splunk.example.test/...` 端点、夹具令牌 |
| 生成产物 | `skills.test.js` 读被跟踪文件（`cordis.patch.yml`、`BACKGROUND.md`、技能、vendor 预设）— 这些测试会因文案漂移而失败，属有意设计 |

## 4. 命名/允许列表回归护栏（漂移栅栏）

发布前运行；它们是整个工具故事的漂移栅栏：

1. `test_server_tools.py`（Python，`len(tools) == 28`）↔ `skills.test.js` "soc_agent MCP allowlist…"（同样的 28 名单，两种语言）。
2. `policy.test.js` "interactive analyst policy exposes the exact product tool set"（30/42/12 计数，派生自 `tool-inventory.js`）。
3. `splunk-bridge.test.js`（只读桥接允许列表、Bearer、TLS 默认、凭据/HTTP 校验、live 管理探测）↔ `skills.test.js` 桥接断言。
4. `action-policy.test.ts`（客户端只用授权 RPC 三元组、失败关闭）。
5. `sections.test.ts`（管理控制台不能绕过只写凭据或在 `/admin` 之外挂载）。

## 5. 测试中的预期生成产物

- 客户端测试经 tsx 导入**源码**（`src/`）— 不测 `lib/`。
- `sections.test.ts` 以文本读取源文件 — 重新排版可能弄断它；有意为之（钉住 "Explicit confirmation" 与发送确认提示等文案）。
- `skills.test.js` 以文本读取 `cordis.patch.yml`/`BACKGROUND.md`/技能 — 编辑这些文件需要同步更新其正则。

## 6. 常见失败及其含义

| 症状 | 含义 |
|---|---|
| 新增工具后 `policy.test.js` 计数失败 | 预期 — 按 [DEVELOPMENT.md](DEVELOPMENT.md) §6 清单更新 |
| `skills.test.js` 补丁断言失败 | `cordis.patch.yml` 名册变更未同步钉扎 |
| `sections.test.ts` 在 UI 编辑后失败 | 护栏文案或挂载结构变了 — 恢复或有意更新护栏 |
| `test_control_server.py` 挂起 | 环境没有可用的 `uv run python`（该测试拉起真实子进程） |
| 客户端测试导入失败 | vendored tsx 加载器缺失 — 先跑 harness 安装 |
| 宿主 JS 测试报 `ERR_MODULE_NOT_FOUND: '@deepseek-ai/schemastery'`（新环境实测） | 应用的 `node_modules` 缺 pnpm 工作区链接 — 运行 `./setup.sh --plugins`（harness `pnpm install`）；vendored schemastery `lib/` 构建须先存在 |
| Python 收集错误：`No module named 'mcp'/'zimbra_client'`（新环境实测） | 虚拟环境不完整 — 在 `apps/soc-agent/server` 运行 `uv sync --extra test` |

## 7. 已知覆盖缺口（是缺口，不是已证缺陷）

1. 无端到端浏览器测试（仅纯函数助手 + 源码文本护栏）。
2. 草稿→界面→`send-email` 链路分段测试，未做一体化集成流。
3. 真实 SQL 行为（声明竞争等）用替身运行；迁移运行器有直接测试但未在 CI 环境对真库执行。
4. `setup.sh`/`update.sh` 无自动化测试（仅参数清单逻辑有 `setup.test.js`）。
5. 仓库根无 CI — 套件需手动运行。

细节: [reference/TEST_COVERAGE_MATRIX.md](../reference/TEST_COVERAGE_MATRIX.md)。

## 仓库中的证据

- 套件配置: `apps/soc-agent/package.json`、`packages/soc-agent-client/package.json`、`apps/soc-agent/server/pyproject.toml`（`[tool.pytest.ini_options]`）。
- 夹具模式: 覆盖矩阵中描述的各测试文件头部/夹具。
