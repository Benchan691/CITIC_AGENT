# 部署与运维（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../DEPLOYMENT_AND_OPERATIONS.md)

**本页读者:** 部署、更新、监控与恢复系统的运维。

**读完后你将了解:** 受支持的拓扑、setup doctor 的逐阶段职责、构建/装配生命周期、启动与健康检查、带干净树规则的更新流程、源码中真实存在的回滚/恢复选项、日志/可观测性，以及值得定期执行的运维安全检查。

**通俗概述。** 一台主机、三个外部服务、一个数据库。`setup.sh` 可复现地安装并修复一切（指纹、逐字节补丁比较、受管插件集合）；`update.sh` 是守纪律的快进；重启是手动的，状态按设计保留（Postgres 会话在；管理员会话不在）。

**前置要求:** [GETTING_STARTED.md](GETTING_STARTED.md)；[CONFIGURATION.md](CONFIGURATION.md)。

---

## 1. 受支持拓扑

单个 Node 宿主进程（vendored harness web 运行时）监听 3080 端口，拉起：Python MCP 服务器（stdio 子进程）、常驻控制通道（stdio 子进程）、一次性管理 CLI 子进程。出站：Zimbra（SOAP）、外部官方 Splunk MCP（streamable HTTP）、订阅服务（HTTPS）、LLM 提供商、PostgreSQL。远程用户通常经 SSH 隧道连接（`ssh -L 3080:127.0.0.1:3080`，见根 README）；反向代理拓扑在本仓库未配置（见未知项）。

## 2. setup doctor 逐阶段职责

| 阶段（`setup.sh`） | 职责 | 修复 |
|---|---|---|
| 布局守卫 | 要求 `vendor/deepseek-harness`、`apps/soc-agent/server/`、`server/.env.example`、`requirements.txt`、补丁文件 | 无 — 直接拒绝 |
| 前置检查 | Node `^22.19.0\|>=24`、pnpm、uv（pnpm PATH 修复） | 带安装提示循环；`skip` 记录警告 |
| 参数收集 | 单一清单驱动提示与检查：PostgreSQL、管理员凭据、加密密钥、**官方 Splunk MCP 端点+令牌（必填）**、Zimbra、订阅、MarkItDown；校验 Postgres URI（正则 + `psql` 探测）；留空自动生成加密密钥。传统 REST Splunk 字段已移除 | 仅缺失/非法项重新询问；已有值成为默认 |
| `write_files` | 播种/更新 `server/.env`（保留注释；可选键仅在有值时写入）与 harness `.env`（仅两个键）；chmod 600；确保 `.gitignore` 覆盖 `.env` | 当 shell 导出值与写入值不同时给出警告（导出优先） |
| `ensure_python_server` | `uv sync --python 3.12`（启用 LLM 时加 `--extra markitdown-llm`） | 失败记录警告并继续 |
| `ensure_harness_ready` | 指纹门控的 `pnpm install --frozen-lockfile` + 构建（指纹：锁文件+包清单 → 安装；harness+八个 SOC 浏览器包源码 → 构建）；校验 `apps/web/dist/index.html`、`mcp-client/lib/index.js` 与每个 `packages/soc-agent-*/lib/client.js` | `--rebuild` 绕过指纹；任一 SOC 浏览器 bundle 漂移会触发浏览器包重建 |
| `ensure_external_plugins` | 把 pnpm 补丁复制进 profile（逐字节比较）、编辑 `pnpm-workspace.yaml` 的 `patchedDependencies`、安装 `requirements.txt` 两个 spec（`pnpm dsh plugin --profile web add`）、**清理受管集合之外的过期插件**、复核 deps+bundles | 重跑即修复；从 `requirements.txt` 删除一行会在下次运行传播到所有机器 |
| `ensure_soc_bundle` | 把 `apps/soc-agent`、强制核心、隔离侧栏/工作区及五个可选 SOC 浏览器包注册进 web profile；校验全部包与 `dsh-soc-agent/auth-host`、`dsh-soc-agent/host`、`@deepseek-ai/dsh-time-context` 及外部插件的解析 | 可重入 |
| 摘要 | 打印掩码值、写入文件、警告、下一步 | **不启动任何服务** |

`--check` 执行只读审计（前置、按优先级的每个参数、Splunk MCP 必配、明文 HTTP 策略、插件解析、profile 补丁/注册、过期插件、构建产物、SOC 漂移、解析）并以失败数 exit 1。

## 3. 构建/装配生命周期

生命周期图见英文站 [site/operations.html](../site/operations.html)；可编辑源 [diagrams/build-test-deploy.mmd](../diagrams/build-test-deploy.mmd)。

权威源 →（八个 SOC 浏览器包：tsdown → **被跟踪**的 `lib/`；harness：pnpm 构建 → 未跟踪 dist）→ profile 装配（`~/.dsh/profiles/web`：manifest bundle、补丁副本）→ 运行时（Node 宿主加载 profile；浏览器挂载被选择的功能插件；拉起 Python 子进程）。指纹让生命周期可复现：相同输入跳过相同工作。

## 4. 启动、重启、健康

- **启动:** `cd vendor/deepseek-harness && pnpm dsh web --no-open` → 打开 `http://127.0.0.1:3080`。
- **可用健康检查:**
  - `./setup.sh --check` — 完整静态审计（随时可跑）。
  - 管理控制台 → Connections → Splunk / Subscription 的 *Check*（Splunk 是**经桥接的实时 `splunk_get_info` 调用**；Zimbra/MarkItDown 只显示环境托管状态）。
  - 浏览器 `/auth/me`（会话探测）与管理员 `/admin/auth/me`。
  - 启动日志行：桥接启用/禁用、插件注册、Python 拉起（`failOnStartupError` 使 Python 死亡在启动时即致命）。
- **重启:** 停止进程再启动。会话、归属、设置存活（Postgres）。管理员会话、会话动作模式覆盖、内存缓存不存活 — 按设计。
- **生成的环境文件:** `server/.env`、`vendor/deepseek-harness/.env`（均 0600）、`.data/harness-*.sha256`；profile 文件在 `~/.dsh/profiles/web/`。

## 5. 更新流程

`./update.sh`: 拒绝参数 → 要求含根 `setup.sh` 的 Git checkout → **拒绝脏工作树**（`git status --porcelain --untracked-files=all`；未跟踪文件也算；从不 stash 或丢弃）→ 当前分支 `git pull --ff-only`（不切换分支）→ `bash setup.sh --plugins` → "restart the web app manually if it is running." 分支切换走 `./setup.sh`（同样要求干净树）。

## 6. 源码中存在的回滚 / 恢复选项

| 情形 | 真实存在的选项 |
|---|---|
| 一次糟糕的更新 | **手动** `git reset`/`git checkout` 上一提交（update.sh 从不操纵历史），然后 `./setup.sh --plugins`；重启 |
| profile 装配损坏 | `./setup.sh --plugins` 重新添加/清理/复核受管插件集合；`--rebuild` 强制完整 harness 重建 |
| SOC 浏览器 bundle 漂移 | setup 检测并自动重建受影响的 SOC 浏览器包（require 允许列表检查） |
| Python 环境失败 | 在 `apps/soc-agent/server` 执行 `uv sync --python 3.12`；重跑 setup |
| `.env` 编辑错误 | 重跑 `./setup.sh`（已有值成为默认；仅非法项重问）— 或从你自己的 0600 文件备份恢复 |
| 密钥轮换后加密行不可读 | 恢复旧的 `APP_SETTINGS_ENCRYPTION_KEY`（运行时拒绝静默继续；错误指明修复方法） |
| 会话清理 | 会话 24 h 过期；`zimbra_auth_error` 自愈（删除应用会话）；撤销一次性且有期限 |

仓库内**没有**数据库备份/恢复命令 — 使用你的 PostgreSQL 工具；把加密密钥与数据一起备份。

## 7. 日志与可观测性

- Python 服务器: `LOG_LEVEL`（默认 INFO）；每次调用记录 `mcp_call ok/failed`，带 prepare/total 耗时与 12 位十六进制关联 id（`execute()`）；意外异常记录**不含**第三方文本。
- Node 宿主: harness 日志；背景刷新警告（`soc-background: … read failed`）；桥接生命周期信息（"official Splunk MCP bridge disabled: …"）。
- 管理命令失败: stderr JSON 解析后经 RPC 呈现（消息 ≤400 字符、最多 20 个 `missing_environment_variables`）。
- 关联: 每次 MCP 调用一个 `soc_correlation_id`（新 UUID）、每个 agent 会话一个 `soc_investigation_id` — 用它们跨 Node/Python 连接日志。
- 无指标/OTel: `session-telemetry-otel` 在补丁中显式禁用。

## 8. 运维安全检查（建议节奏）

1. 每次更新后与定期执行 `./setup.sh --check`。
2. 部署改动的 checkout 前运行三个测试套件（[TESTING.md](TESTING.md)）— 尤其是命名栅栏。
3. 核对桥接姿态：Splunk 未配置时确认日志显示 disabled（缺失即安全的工具面）。
4. 确认管理员凭据环境变量在启动时已设置（启动抛错正是控制在工作）。
5. 手动 `pnpm dsh plugin` 操作后复查 `~/.dsh/profiles/web` 有无未管插件。
6. 备份: PostgreSQL + `APP_SETTINGS_ENCRYPTION_KEY` + 两个 `.env` 文件（[DATA_AND_PERSISTENCE.md](DATA_AND_PERSISTENCE.md)）。

## 仓库中的证据

- `setup.sh`（全部阶段、`--check` 检查、指纹/清理头注释）、`update.sh`、根 `README.md`（运行/隧道/更新、MCP 必配）、`host.js`（经 RPC 的健康端点、管理页服务）、`splunk-bridge.js`（live 探测）、`admin_cli.py`（测试命令）、`cordis.patch.yml`（遥测禁用、`failOnStartupError`）。

## 未知项

- 生产进程监管（systemd/容器）不在本仓库配置；`RUNNING_INSIDE_DOCKER` 处理已随本轮移除，容器部署定义在仓库之外。
- 日志聚合与告警是仓库之外的部署事项。
