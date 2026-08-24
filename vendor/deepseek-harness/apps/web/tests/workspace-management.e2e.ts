// Browser coverage for the logical-folder sidebar. Filesystem workspace
// picking deliberately lives outside this product composition.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Browser, Locator, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  acknowledgeReloadConnectionLoss, assertFixtureInventory, launchWebScaffold,
  seedSession, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/workspace-management', import.meta.url))
const SEED = fileURLToPath(new URL('./snapshots/seeded-history/seed.jsonl', import.meta.url))
const SHIPPED_PRESETS = fileURLToPath(new URL('../../cli/config/agent-presets', import.meta.url))
const SEED_ID = 'workspace-management-web-e2e'
const MODE = webSnapshotMode()

describe('web e2e: logical folder management', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  async function clickHoverAction(row: Locator, name: string): Promise<void> {
    const button = row.getByRole('button', { name })
    await expect.poll(async () => {
      await row.hover()
      return button.isVisible()
    }, { timeout: 10_000 }).toBe(true)
    await button.click()
  }

  async function createFolder(name: string): Promise<void> {
    await page.getByRole('button', { name: 'New folder' }).click()
    const dialog = page.getByRole('dialog', { name: 'New folder' })
    await dialog.getByLabel('Folder name').fill(name)
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 10_000 })
    await page.locator('[role="treeitem"]').filter({ hasText: name }).first()
      .waitFor({ timeout: 10_000 })
  }

  async function reload(): Promise<void> {
    const warningStart = tripwire.warnings.length
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    acknowledgeReloadConnectionLoss(tripwire, warningStart)
  }

  beforeAll(async () => {
    scaffold = await launchWebScaffold({
      agentPresets: { default: 'citic-soc', roots: [{ path: SHIPPED_PRESETS, trust: 'system' }] },
    })
    await seedSession(scaffold, await readFile(SEED, 'utf8'), SEED_ID)
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    await page.getByText('General', { exact: true }).waitFor({ timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('keeps the composer usable after choosing an optional folder', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-folder-composer'))
    const agentsBeforeNewSession = scaffold.ctx.agents.list().length
    await page.getByRole('button', { name: 'New session' }).last().click()
    await expect.poll(() => scaffold.ctx.agents.list().length, { timeout: 10_000 })
      .toBeGreaterThan(agentsBeforeNewSession)
    const agentsBeforePick = scaffold.ctx.agents.list().length
    const folderPicker = page.getByRole('button', { name: 'Choose folder (optional)' })
    await folderPicker.waitFor({ timeout: 10_000 })
    await folderPicker.click()
    await page.getByRole('menuitem', { name: 'New folder…' }).click()
    const dialog = page.getByRole('dialog', { name: 'New folder' })
    await dialog.getByLabel('Folder name').fill('Test')
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    await expect.poll(async () => {
      const folder = (await scaffold.ctx.sessionFolders.listFolders()).find(candidate => candidate.name === 'Test')
      return folder?.sessionIds.length ?? 0
    }, { timeout: 10_000 }).toBe(1)
    expect(scaffold.ctx.agents.list()).toHaveLength(agentsBeforePick)
    await expect.poll(() => folderPicker.textContent(), { timeout: 10_000 }).toContain('Test')
    const composer = page.getByRole('textbox', { name: 'Give me some work to do' })
    await expect.poll(() => composer.isEnabled(), { timeout: 10_000 }).toBe(true)
    await composer.fill('composer remains usable')
    expect(await composer.inputValue()).toBe('composer remains usable')
  }, 60_000)

  it('creates, rejects a duplicate, renames, and deletes a logical folder', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-folder-lifecycle'))
    await createFolder('SOC Investigations')
    expect((await scaffold.ctx.sessionFolders.listFolders()).map(folder => folder.name))
      .toContain('SOC Investigations')

    await page.getByRole('button', { name: 'New folder' }).click()
    const create = page.getByRole('dialog', { name: 'New folder' })
    await create.getByLabel('Folder name').fill('SOC Investigations')
    await create.getByRole('button', { name: 'Create', exact: true }).click()
    const error = page.getByRole('dialog', { name: 'Couldn’t create folder' })
    await error.waitFor({ timeout: 10_000 })
    expect(await error.getByRole('alert').textContent()).toContain('already exists')
    await error.getByRole('button', { name: 'Cancel' }).click()

    const row = page.locator('[role="treeitem"]').filter({ hasText: 'SOC Investigations' }).first()
    await clickHoverAction(row, 'Folder actions for SOC Investigations')
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    const rename = page.getByRole('dialog', { name: 'Rename folder' })
    await rename.getByLabel('Folder name').fill('Incident Queue')
    await rename.getByRole('button', { name: 'Rename' }).click()
    await page.locator('[role="treeitem"]').filter({ hasText: 'Incident Queue' }).first()
      .waitFor({ timeout: 10_000 })

    await reload()
    const renamed = page.locator('[role="treeitem"]').filter({ hasText: 'Incident Queue' }).first()
    await clickHoverAction(renamed, 'Folder actions for Incident Queue')
    await page.getByRole('menuitem', { name: 'Delete folder' }).click()
    const remove = page.getByRole('dialog', { name: 'Delete folder' })
    expect(await remove.textContent()).toContain('permanently deletes')
    await remove.getByRole('button', { name: 'Delete folder' }).click()
    await expect.poll(
      () => page.locator('[role="treeitem"]').filter({ hasText: 'Incident Queue' }).count(),
      { timeout: 10_000 },
    ).toBe(0)
    expect((await scaffold.ctx.sessionFolders.listFolders()).map(folder => folder.name))
      .not.toContain('Incident Queue')
  }, 90_000)

  it('persists the compact one-list view and restores folder grouping', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-folder-flat-view'))
    await page.getByRole('button', { name: 'View options' }).click()
    await page.getByRole('menuitem', { name: 'In one list' }).click()
    await page.getByText('Sessions', { exact: true }).waitFor({ timeout: 10_000 })
    expect(await page.evaluate(() => localStorage.getItem('dsh.workspace.view.v5'))).toContain('flat')

    await reload()
    await page.getByText('Sessions', { exact: true }).waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: 'View options' }).click()
    await page.getByRole('menuitem', { name: 'Folder' }).click()
    await page.getByText('Folders', { exact: true }).waitFor({ timeout: 10_000 })
    await page.locator('[role="treeitem"]').filter({ hasText: 'General' }).first().waitFor({ timeout: 10_000 })
  }, 60_000)

  it('archives a chat durably across a folder-baseline reload', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-folder-archive'))
    const general = page.locator('[role="treeitem"]').filter({ hasText: 'General' }).first()
    const section = general.locator('xpath=ancestor::*[contains(@class, "groupSection")][1]')
    if (await general.getAttribute('aria-expanded') !== 'true') await general.click()
    const sessionRow = section.locator('[role="treeitem"]')
      .filter({ has: page.locator('button[aria-label^="Session actions for "]') }).first()
    await sessionRow.waitFor({ timeout: 10_000 })
    const title = await sessionRow.locator('[class*="title"]').innerText()
    await clickHoverAction(sessionRow, `Session actions for ${title}`)
    await page.getByRole('menuitem', { name: 'Archive session' }).click()
    await expect.poll(() => page.getByText(title, { exact: true }).count(), { timeout: 10_000 }).toBe(0)
    expect([...scaffold.ctx.workspaceRegistry.archivedSessionIds]).toEqual([SessionId(SEED_ID)])

    await reload()
    await page.getByText('Folders', { exact: true }).waitFor({ timeout: 10_000 })
    expect(await page.getByText(title, { exact: true }).count()).toBe(0)
    expect((await scaffold.ctx.sessionPersistence.list()).map(header => header.id))
      .toContain(SessionId(SEED_ID))
  }, 90_000)

  it.skipIf(MODE === 'record')('issued zero model calls and stayed clean', async () => {
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['.gitkeep'])
  })
})
