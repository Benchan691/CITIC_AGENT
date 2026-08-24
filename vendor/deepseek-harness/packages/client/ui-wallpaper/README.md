# `@deepseek-ai/dsh-client-ui-wallpaper`

Host-backed UI wallpaper plugin: upload cropped background images, tune opacity / fit / position, and apply them to major shell surfaces (`shell`, `sidebar`, `conversation`, `composer`).

English | [中文](README.zh.md)

## What it does

- **Host half** (`src/index.ts`): registers the `ui-wallpaper` settings namespace and serves `$DSH_HOME/ui-wallpapers` under `/ui-wallpapers` (POST upload, GET/HEAD serve, DELETE).
- **Client half** (`src/client/`): provides `ctx.wallpaper`, seats a **Plugins** settings card, and paints overlays onto `[data-wallpaper-surface]` hosts.

Settings live in `$DSH_HOME/settings.yaml`; image bytes stay on disk (not in the YAML document).

## Using a surface

1. Mark a root element: `data-wallpaper-surface="my-surface"`.
2. Optionally register it for the settings picker:

```ts
ctx.inject(['wallpaper'], (wallpaperCtx) => {
  wallpaperCtx.effect(
    () => wallpaperCtx.wallpaper.registerSurface({ id: 'my-surface', label: 'My surface' }),
    'my-plugin: wallpaper surface',
  )
})
```

Built-in surfaces are already wired in `ui-layout`, `ui-sidebar`, and `ui-conversation`.

## Settings UI

Open **Settings → Plugins**, expand **UI backgrounds**, and pick a surface. Upload an image, then drag or use the arrow keys to pan and use the wheel, `+`/`-`, or the zoom slider to crop. Opacity, scrim, fit, and position changes preview and apply immediately on loopback Hosts; remote sessions can inspect every surface but cannot change them. Replacing or clearing the last use of an image removes its stored asset.
