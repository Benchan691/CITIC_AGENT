# 快速开始（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../GETTING_STARTED.md)。英文版为原文，本页为对应翻译。

**本页读者:** 首次搭建环境或审计现有环境的开发者与运维人员。

**读完后你将了解:** 前置要求、四种安装形态、如何安全准备配置、如何启动应用、首次无损验证，以及首启常见故障。

**通俗概述。** 一个脚本 — `setup.sh`（"setup doctor"）— 负责检查前置要求、交互式收集配置（写入两个限权 `.env` 文件）、安装依赖、构建内置 harness，并把 SOC 产品装配进 harness 的 web profile。它不启动任何服务：应用由你用一条命令自行启动。第二个脚本 `update.sh` 在干净的工作树上快进更新并重跑修复/装配流程。

---

## 1. 前置要求

| 要求 | 版本 / 检查方式 | 说明 |
|---|---|---|
| Node.js | `^22.19.0` 或 `>=24`（`run_prereq_checks` 正则校验） | vendored 工作区要求 |
| pnpm、uv、Git | 任意近期版本；setup 会在缺少 pnpm 时把 `~/.local/share/pnpm/bin` 加入 PATH（Corepack） | 包管理器 / Python 运行器 |
| Python | 3.12（由 uv 管理；`uv sync --python 3.12`） | 服务器要求 `requires-python = ">=3.12"` |
| PostgreSQL | 可达的数据库 | `APP_POSTGRES_URI`；缺失时登录按设计失败关闭（fail closed） |
| openssl（或 /dev/urandom） | 用于密钥生成 | `APP_SETTINGS_ENCRYPTION_KEY` 自动生成 |

必须自备的外部服务：Zimbra 主机；**官方 Splunk MCP 端点 + 令牌（必需 — setup 与 `--check` 缺失即失败）**；可选的订阅服务；运行时在管理界面配置的 LLM 提供商密钥。

## 2. 五种安装形态

| 场景 | 命令 | 行为 |
|---|---|---|
| 全新安装（无 checkout） | 任意位置 `bash setup.sh`（bootstrap） | 提示仓库 URL、安装路径（默认 `~/CITIC_AGENT`）、分支；克隆（或快进复用已有 checkout）；转入克隆内的 `setup.sh` 继续 |
| 已有 checkout | `./setup.sh`（交互） | 前置检查 → 参数收集 → 写配置文件 → Python 环境 → harness 构建 → 插件装配 → SOC bundle 注册 → 摘要（不启动任何服务）。已有值成为默认值，仅缺失/非法项重新询问 |
| 仅审计（不写入） | `./setup.sh --check` | 只报告；缺项即 exit 1；从不写入 |
| 非交互修复/重装配 | `./setup.sh --plugins`（可加 `--rebuild`） | 前置检查、Python 环境、harness 构建（指纹门控）、插件安装/清理/校验、SOC bundle 注册。无提示、不写 env |
| 更新已有部署 | `./update.sh` | 拒绝参数与脏工作树；当前分支 `git pull --ff-only`；随后 `setup.sh --plugins`；应用需手动重启 |

分支切换：只能通过 `./setup.sh`，且要求**干净工作树**（`git status --porcelain`）；从不 stash 或丢弃本地修改。

**开发模式与部署模式。** 两种模式的 setup 阶段完全相同；区别在于运行位置与启动方式。开发模式是你编辑的 checkout，用 `pnpm dsh web` 手动启动。部署模式是把同样的 setup 跑在服务器上（`.env.example` 曾有的 `RUNNING_INSIDE_DOCKER` 变量暗示存在本仓库之外定义的容器化部署），启动同样以手动为主，除非你的服务管理器包装它 —— 本仓库不配置进程监管。运行态数据（`.env`、`.data`、PostgreSQL、`~/.dsh`）都在 Git 之外，两种模式下都能在更新后保留。

## 3. setup 询问并写入什么

`collect_parameters` 以优先级 `.env.example` < harness `.env` < server `.env` < **当前环境**（环境变量最高）合并默认值，并提示收集：

- `APP_POSTGRES_URI`（正则校验 + 尽力 `psql` 探测）与 `APP_SETTINGS_ENCRYPTION_KEY`（留空则自动生成 32 字节十六进制）— 机密以 `read -rs` 静默输入。
- `SOC_ADMIN_EMAIL` / `SOC_ADMIN_PASSWORD` — 静态管理员登录。两者**仅属于 Node 宿主**；setup 与运行时都会把它们从所有 Python 子进程环境中剔除。
- Splunk：仅官方 MCP 连接 — `SPLUNK_MCP_ENDPOINT` + `SPLUNK_TOKEN` **必填**，另有 `SPLUNK_VERIFY_SSL`（默认 true）与 `SPLUNK_ALLOW_INSECURE_HTTP`（`http://` 端点必须为 true）。本轮已删除所有传统 REST Splunk 字段。
- Zimbra：`ZIMBRA_HOST`、TLS 选项。
- 订阅服务：`SUBSCRIPTION_SERVER_URL`、用户、密码、TLS 选项。
- MarkItDown LLM：`MARKITDOWN_LLM_ENABLED`（为 true 时必填 key+model）。

写入的文件（只列名字，内容绝不要贴进工单或聊天）：`apps/soc-agent/server/.env`（从 `.env.example` 播种，chmod 600）、`vendor/deepseek-harness/.env`（仅 Postgres URI + 加密密钥，chmod 600）、`.gitignore`（仅在缺少 `.env` 规则时）、`.data/harness-*.sha256` 指纹。仓库之外：`~/.dsh/profiles/web/`（补丁副本、`pnpm-workspace.yaml`、插件清单）。摘要只打印**掩码后**的值。

## 4. 开发启动

```bash
# 仓库根目录
cd vendor/deepseek-harness
pnpm dsh web --no-open
```

打开 `http://127.0.0.1:3080`（摘要会打印；远程访问通常用 `ssh -L 3080:127.0.0.1:3080 user@host`）。Node 宿主加载 web profile，拉起 Python `soc_agent` stdio 服务器，并在配置齐全时连接 `splunk_mcp` 桥接。Python 启动失败是致命的（`failOnStartupError: true`）；缺少 Splunk 端点/令牌只会禁用桥接并打一条日志。

客户端改动后的重建：`pnpm --filter dsh-soc-agent-client run build`（或 `./setup.sh --plugins`，它会检测 bundle 漂移并修复）。参见 [DEVELOPMENT.md](DEVELOPMENT.md)。

## 5. 首次无损验证

1. `./setup.sh --check` — 只有前置要求、配置、构建、profile 装配全部健康才 exit 0。
2. 打开应用：应看到 **Sentinel 登录**全屏遮罩。未认证用户什么都点不开 — 整个 shell 被 `AuthGate` 覆盖。
3. 用**你本人的 Zimbra 邮箱和密码**登录（不是管理员那对）。`/auth/me` 应返回你的地址；`.data/soc-workspaces/<userId>/` 下会创建私有工作区。
4. 管理控制台（`/admin`，管理员凭据）→ **Connections**：对 Splunk（仅桥接配置后有意义）和订阅服务点 *Check*；Zimbra/MarkItDown 只显示环境托管状态。
5. 以分析师身份：让智能体列出邮箱文件夹（`zimbra_list_folders`）或在桥接配置后列出 Splunk 索引（`splunk_get_indexes`）。SOC 模式下读工具自动执行；变更类工具（如建文件夹）会触发界面**审批请求**。
6. 不发送任何邮件：让智能体建一封草稿并观察草稿卡片 — 发送始终被显式 **Send** 确认门控。

绝不要把真实机密粘贴进可能进入 shell 历史的命令。用交互提示或直接编辑 chmod 600 的 `.env` 文件。

## 6. 首启常见故障

| 症状 | 可能原因 | 首选诊断 |
|---|---|---|
| `setup.sh` 退出并列出缺失前置 | Node/pnpm/uv 缺失或版本不符 | 按 §1 安装后重跑（可选 `skip` 但会记录警告） |
| 登录总是失败 | `APP_POSTGRES_URI` 缺失/错误（存储按设计失败关闭）或 Zimbra 拒绝 | 日志中查 `authentication_required`；验证 Postgres 可达；直接用 Zimbra 验证凭据 |
| 应用启动但 Zimbra 工具全部失效 | Python 服务器拉起失败（致命）或 `APP_SETTINGS_ENCRYPTION_KEY`/Postgres 缺失 | 启动日志；`apps/soc-agent/server` 内 `uv sync`；`./setup.sh --plugins` |
| 完全没有 Splunk 工具 | setup/`--check` 现在要求官方 MCP 连接；缺端点+令牌时桥接保持禁用 | 设好 `SPLUNK_MCP_ENDPOINT` + `SPLUNK_TOKEN`（见 [CONFIGURATION.md](CONFIGURATION.md)）；日志中查 "official Splunk MCP bridge disabled" |
| 管理控制台拒绝登录 | 宿主启动时 `SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD` 不对；管理员会话在内存中，宿主重启即登出 | 修好 `.env` 后重启宿主；重新登录 |
| "Stored Zimbra accounts are no longer supported" | 调用了遗留账户 RPC | 预期拒绝；请用 Zimbra 登录 |
| 修改 `packages/soc-agent-client/src` 后界面陈旧 | 被跟踪的 `lib/` 产物未重建 | `pnpm --filter dsh-soc-agent-client run build` 或 `./setup.sh --plugins` |
| profile 中出现多余/过期插件 | `requirements.txt` 与 profile 漂移 | `./setup.sh --plugins` 会裁剪到受管集合 |

更多内容: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。下一步: [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md)（你刚启动的是什么）、[CONFIGURATION.md](CONFIGURATION.md)（每个变量）、[DEPLOYMENT_AND_OPERATIONS.md](DEPLOYMENT_AND_OPERATIONS.md)（运维生命周期）。

## 仓库中的证据

- `setup.sh`（各阶段、各模式、写入文件、`PLUGIN_NAMES`）、`update.sh`、`requirements.txt`
- `apps/soc-agent/cordis.patch.yml`（`failOnStartupError`、桥接 env）、`apps/soc-agent/splunk-bridge.js`（`resolveOfficialSplunkConfig`）
- `apps/soc-agent/ownership.js`（缺少管理员凭据即抛错）、`apps/soc-agent/host.js`（`serveAdminPage`）
- `packages/soc-agent-client/src/client/AuthGate.tsx`（Sentinel 登录）、`apps/soc-agent/server/.env.example`（变量名）
- 根目录 `README.md`（启动命令、端口 3080）

## 假设与未知

- 本页依据锁定提交的源码与清单编写；编写过程中未执行任何 setup 命令。
- 你的外部 Zimbra/Splunk/订阅端点的具体行为取决于环境，不在本文档范围内。
