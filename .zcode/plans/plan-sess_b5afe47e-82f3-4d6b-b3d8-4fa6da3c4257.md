Remove the modlens plugin and all related references (keeping ui-skin-center and auto-collapse).

## 1. Repo changes

- `requirements.txt`: delete the line `@liustack/modlens@^3.18.3` (leaves the other two external bundles).
- `setup.sh`:
  - remove `"@liustack/modlens"` from the `PLUGIN_NAMES` array (line ~97) — the count check in `read_plugin_requirements` stays consistent at 2 specs / 2 names;
  - remove `@liustack/modlens` from the `verify_profile_resolution()` spec list (line ~855).
- Nothing else in the repo references modlens (verified: no patch file, no cordis.yml, no client code — it's purely an external profile bundle).

## 2. Uninstall from the installed harness profile

- From `vendor/deepseek-harness`: `pnpm dsh plugin --profile web remove @liustack/modlens` — runs pnpm remove inside the profile and reconciles `dsh.profile.bundles` (drops the modlens layer entry).
- Fallback if the bundle entry lingers after reconcile: hand-edit `~/.dsh/profiles/web/package.json` to drop it.

## 3. Remove runtime artifacts

- Delete `~/.modlens/` (the plugin's config/cache home: auto-cache.json, config.json, evidence caches). It regenerates if ever reinstalled.

## 4. Verify

- `./setup.sh --check` → external-plugins section lists only skin-center and auto-collapse; artifact guard and profile resolution all green.
- Grep the profile manifest to confirm no modlens remains in `dependencies` or `dsh.profile.bundles`.

## 5. Commit + push (same pattern as the prepare-fix and your ui-wallpaper removal)

- Commit `requirements.txt` + `setup.sh` with message "Remove modlens plugin and related references", push to `main`, verify via `gh api`.

Note: the currently running app still has modlens loaded in memory — a restart (Ctrl+C → `pnpm dsh web`) is needed for the removal to take effect.