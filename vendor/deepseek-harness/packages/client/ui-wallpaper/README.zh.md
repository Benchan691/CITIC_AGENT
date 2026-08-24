# `@deepseek-ai/dsh-client-ui-wallpaper`

Host 侧持久化的界面背景插件：上传裁剪后的背景图，调节透明度／填充／位置，并应用到主要壳层区域（`shell`、`sidebar`、`conversation`、`composer`）。

[English](README.md) | 中文

## 作用

- **Host 半边**（`src/index.ts`）：注册 `ui-wallpaper` 设置命名空间，并在 `/ui-wallpapers` 下提供 `$DSH_HOME/ui-wallpapers`（POST 上传、GET/HEAD 读取、DELETE）。
- **Client 半边**（`src/client/`）：提供 `ctx.wallpaper`，在 **插件** 设置页挂载卡片，并向 `[data-wallpaper-surface]` 宿主绘制叠加层。

配置写入 `$DSH_HOME/settings.yaml`；图片字节保存在磁盘，不会塞进 YAML。

## 接入一个表面

1. 在根元素上标记：`data-wallpaper-surface="my-surface"`。
2. 可选：向设置选择器注册：

```ts
ctx.inject(['wallpaper'], (wallpaperCtx) => {
  wallpaperCtx.effect(
    () => wallpaperCtx.wallpaper.registerSurface({ id: 'my-surface', label: 'My surface' }),
    'my-plugin: wallpaper surface',
  )
})
```

内置表面已由 `ui-layout`、`ui-sidebar`、`ui-conversation` 接入。

## 设置界面

打开 **设置 → 插件**，展开 **界面背景**并选择区域。上传图片后，可拖动或使用方向键平移，也可用滚轮、`+`/`-` 或缩放滑块裁剪。透明度、遮罩、填充与位置的变更会在回环 Host 上即时预览并生效；远程会话可查看每个区域，但不能修改。替换图片或清除图片的最后一处引用时，已存储的资产也会删除。
