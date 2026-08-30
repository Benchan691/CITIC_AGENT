import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import FileSettingsProvider from '../src/index.ts'

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!()
})

async function tempHome(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'dsh-settings-wallpaper-migration-'))
  cleanups.push(() => rm(home, { recursive: true, force: true }))
  return home
}

async function boot(config: ConstructorParameters<typeof FileSettingsProvider>[1]): Promise<Context> {
  const ctx = new Context()
  const fiber = ctx.plugin(FileSettingsProvider, config)
  cleanups.push(async () => { await fiber.dispose() })
  await fiber
  return ctx
}

async function seedAssets(home: string): Promise<string> {
  const root = join(home, 'ui-wallpapers')
  await mkdir(root, { recursive: true })
  await writeFile(join(root, 'legacy.png'), 'old wallpaper')
  return root
}

describe('legacy ui-wallpaper cleanup', () => {
  it('removes the legacy YAML section and assets while preserving other settings', async () => {
    const home = await tempHome()
    const path = join(home, 'custom', 'settings.yml')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, [
      'ui-wallpaper:',
      '  surfaces:',
      '    shell:',
      '      imageId: legacy',
      '# keep this comment',
      'ui-theme:',
      '  theme: dark',
      '',
    ].join('\n'))
    const assets = await seedAssets(home)

    await boot({ path, dshHome: home, legacyUiWallpaperCleanup: true, watch: false })

    const written = await readFile(path, 'utf8')
    expect(written).not.toContain('ui-wallpaper')
    expect(written).toContain('# keep this comment')
    expect(written).toContain('ui-theme:')
    expect(written).toContain('theme: dark')
    await expect(stat(assets)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('removes the legacy JSON section from the active custom settings path', async () => {
    const home = await tempHome()
    const path = join(home, 'settings.json')
    await writeFile(path, JSON.stringify({
      'ui-wallpaper': { surfaces: { sidebar: { imageId: 'legacy' } } },
      'ui-theme': { theme: 'light' },
    }, null, 2))
    const assets = await seedAssets(home)

    await boot({ path, dshHome: home, legacyUiWallpaperCleanup: true, watch: false })

    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ 'ui-theme': { theme: 'light' } })
    await expect(stat(assets)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('is safe when no settings document or assets exist and is idempotent', async () => {
    const home = await tempHome()
    const config = { dshHome: home, legacyUiWallpaperCleanup: true, watch: false }

    await boot(config)
    await boot(config)

    await expect(stat(join(home, 'settings.yaml'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(stat(join(home, 'ui-wallpapers'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('fails before deleting assets when the active settings document is invalid', async () => {
    const home = await tempHome()
    const path = join(home, 'settings.yaml')
    await writeFile(path, 'ui-wallpaper: [unclosed\n')
    const assets = await seedAssets(home)

    await expect(boot({ path, dshHome: home, legacyUiWallpaperCleanup: true, watch: false })).rejects.toThrow()

    expect(await readFile(path, 'utf8')).toContain('ui-wallpaper')
    await expect(stat(assets)).resolves.toBeDefined()
  })

  it('does not touch legacy data unless the shipped cleanup option is enabled', async () => {
    const home = await tempHome()
    const path = join(home, 'settings.yaml')
    await writeFile(path, 'ui-wallpaper:\n  surfaces: {}\n')
    const assets = await seedAssets(home)

    await boot({ path, dshHome: home, watch: false })

    expect(await readFile(path, 'utf8')).toContain('ui-wallpaper')
    await expect(stat(assets)).resolves.toBeDefined()
  })
})
