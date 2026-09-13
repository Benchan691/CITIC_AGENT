# SOC 客户端插件

> **校验基线：**提交 `56c8dd2` 及当前被跟踪的浏览器产物。

SOC 浏览器界面现在拆分为相互独立的第一方插件。官方 Harness sidebar
和 workspace 实现仍保留在冻结的 vendor 树中，但 SOC profile 会禁用它们，
并启用隔离的替代实现。这样既保留当前外观和宿主 slot 名称，也可以逐项
禁用可选 SOC 功能。

## 包矩阵

| 包 | 配置行 | 默认 | 所有权 |
|---|---|---:|---|
| `dsh-soc-agent-client` | `soc-agent-client-core` | 必需 | 认证门、`socClient` runtime、action-policy schema、`/admin` root 与安全 fallback |
| `dsh-soc-agent-sidebar` | `soc-agent-sidebar-ui` | 必需 | 隔离的标准 `sidebar` slot、展开/折叠布局、child-slot contract |
| `dsh-soc-agent-workspace` | `soc-agent-workspace-ui` | 必需 | workspace/session 浏览器、picker、搜索、分组、排序、重命名/复制/归档/删除，以及可逆的 `api.folders` guard |
| `dsh-soc-agent-brand` | `soc-agent-brand-ui` | 启用 | CITIC/Sentinel sidebar 与会话 branding |
| `dsh-soc-agent-admin` | `soc-agent-admin-ui` | 启用 | `/admin` 四页管理控制台及设置界面 |
| `dsh-soc-agent-action-policy` | `soc-agent-action-policy-ui` | 启用 | 用户 Full access/SOC mode 选择器 |
| `dsh-soc-agent-attachments` | `soc-agent-attachments-ui` | 启用 | MarkItDown provider、文档 rail、文件命令、设置卡片及 attachment schema |
| `dsh-soc-agent-email-draft` | `soc-agent-email-draft-ui` | 启用 | 可编辑的 Zimbra 发送/转发/签名 tool view |

五个 feature 行是可选的；core、隔离 sidebar 和隔离 workspace 是必需的。
即使可选行被禁用，八个浏览器产物仍会安装和构建，因此重新启用只需要
修改 profile 配置。

## 共享 runtime contract

可选浏览器插件依赖 `dsh-soc-agent-client` 并注入它的 Cordis service。
公开声明位于 `dsh-soc-agent-client/client`：

```ts
interface SocClientRuntime {
  readonly surface: 'workspace' | 'admin'
  rpc<T>(name: string, payload?: Record<string, unknown>): Promise<T>
}
```

Core 通过已认证的 `/soc-agent-config` channel 发送请求。只有 `/admin` 和
`/admin/*` 选择 `admin` surface。Core 所有 `/admin` root takeover，并声明
`soc.admin.content`。禁用 admin feature 时，该 slot 显示安全的
“Administration UI is disabled”页面，不会让普通 workspace 出现在管理路由。

Action-approval schema 仍在必需 core 中，确保关闭用户选择器后宿主策略和
管理控制仍存在。Attachment schema 属于 attachment 插件；禁用该插件会
移除完整功能但不会删除已保存偏好。

## 按需禁用

编辑 `apps/soc-agent/cordis.patch.yml`，例如：

```yaml
- id: soc-agent-attachments-ui
  disabled: true
```

其他 feature 行保持独立。组合测试会验证每个 feature 单独禁用时 core、
隔离 sidebar 和隔离 workspace 仍然启用。source/manifest 隔离测试会递归
检查所有第一方生产文件，不允许导入官方 sidebar/workspace 包。

## 构建、setup 与验证

在 vendored Harness workspace 中，八个包分别使用：

```bash
pnpm --filter dsh-soc-agent-client run build
pnpm --filter dsh-soc-agent-sidebar run build
pnpm --filter dsh-soc-agent-workspace run build
pnpm --filter dsh-soc-agent-brand run build
pnpm --filter dsh-soc-agent-admin run build
pnpm --filter dsh-soc-agent-action-policy run build
pnpm --filter dsh-soc-agent-attachments run build
pnpm --filter dsh-soc-agent-email-draft run build
```

`./setup.sh --plugins` 使用唯一的八包矩阵，负责依赖安装、Harness 构建、
产物修复、source fingerprint、web profile 注册、解析检查和浏览器可用的
external require 检查。`./setup.sh --check` 只读审计同一组产物和 profile。

浏览器 smoke 从 Harness workspace 运行：

```bash
pnpm exec vitest run --config ../../apps/soc-agent/tests/vitest.browser.config.mjs
```

它在 fixture 模式加载真实 bundle，仅拦截认证，检查隔离 sidebar/workspace
和会话 picker，生成展开/折叠/列表/picker 截图，拒绝浏览器错误和失败资源，
并确认没有请求官方 sidebar/workspace bundle。

## snapshot 来源与回滚

隔离 sidebar/workspace 是 `56c8dd2` 的当前 UI 视觉 snapshot。来源 hash 位于：

- `packages/soc-agent-sidebar/snapshot-baseline.json`
- `packages/soc-agent-workspace/snapshot-baseline.json`
- `apps/soc-agent/tests/__screenshots__/`

官方文件 `vendor/deepseek-harness/packages/client/ui-sidebar` 和
`vendor/deepseek-harness/packages/client/ui-workspace` 不会被修改。回滚只需
配置操作：禁用 SOC sidebar/workspace 行，重新启用官方 `ui-sidebar` 和
`ui-workspace`，然后重启 web app。本次拆分没有后端路由或持久化
workspace/session schema 迁移。
