import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium } from '../../../vendor/deepseek-harness/apps/web/node_modules/playwright/index.mjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { healProfilesModuleFallback } from '../../../vendor/deepseek-harness/packages/boot/app-boot/src/index.ts'
import {
  launchWebScaffold,
  watchConsole,
} from '../../../vendor/deepseek-harness/apps/web/tests/scaffold.ts'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const socPatch = join(repoRoot, 'apps/soc-agent/cordis.patch.yml')
const screenshotDir = join(repoRoot, 'apps/soc-agent/tests/__screenshots__')
const updateScreenshots = process.env.UPDATE_SOC_SCREENSHOTS === '1'

async function assertOrWriteScreenshot(locator, name) {
  const actual = await locator.screenshot({ animations: 'disabled' })
  const path = join(screenshotDir, name)
  if (updateScreenshots) {
    await mkdir(screenshotDir, { recursive: true })
    await writeFile(path, actual)
    return
  }
  let expected
  try {
    expected = await readFile(path)
  } catch {
    throw new Error(`missing browser screenshot ${path}; run UPDATE_SOC_SCREENSHOTS=1 pnpm exec vitest run --config ../../apps/soc-agent/tests/vitest.browser.config.mjs from vendor/deepseek-harness`)
  }
  assert.deepEqual(actual, expected, `browser screenshot changed: ${path}`)
}

function installErrorTripwires(page) {
  const consoleErrors = []
  const pageErrors = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => pageErrors.push(error.stack ?? String(error)))
  return { consoleErrors, pageErrors }
}

describe('SOC browser composition', () => {
  let scaffold
  let browser
  let page
  let tripwires
  let warnings
  let browserRequests
  let failedRequests
  let badResponses
  let harnessHome
  let browserOverlayHome

  beforeAll(async () => {
    harnessHome = await mkdtemp(join(tmpdir(), 'dsh-soc-browser-home-'))
    healProfilesModuleFallback(join(repoRoot, 'apps/soc-agent/package.json'), harnessHome)
    // Keep the product patch intact while omitting its Python MCP child for
    // this browser-only lane; fixture data supplies the client state and the
    // browser contract under test does not need a live external process.
    browserOverlayHome = await mkdtemp(join(tmpdir(), 'dsh-soc-browser-overlay-'))
    const browserPatch = join(browserOverlayHome, 'cordis.patch.yml')
    await writeFile(browserPatch, `${await readFile(socPatch, 'utf8')}\n- id: soc-agent-mcp\n  disabled: true\n`)
    scaffold = await launchWebScaffold({ extraOverlayPath: browserPatch, harnessHome })
    browser = await chromium.launch({ headless: true })
    page = await browser.newPage({
      viewport: { width: 1680, height: 1000 },
      locale: 'en-US',
    })
    tripwires = installErrorTripwires(page)
    warnings = watchConsole(page)
    browserRequests = []
    failedRequests = []
    badResponses = []
    page.on('request', request => browserRequests.push(request.url()))
    page.on('requestfailed', request => failedRequests.push(`${request.url()} (${request.failure()?.errorText || 'unknown'})`))
    page.on('response', response => {
      if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`)
    })
    // The fixture transport owns all workspace/session data. Authentication is
    // the only browser boundary this test replaces.
    await page.route('**/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: { zimbra_email: 'analyst@example.com' },
        }),
      })
    })
    await page.goto(`${scaffold.baseUrl}/?fixture`, { waitUntil: 'load' })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
    if (harnessHome !== undefined) await rm(harnessHome, { recursive: true, force: true })
    if (browserOverlayHome !== undefined) await rm(browserOverlayHome, { recursive: true, force: true })
  })

  it('mounts isolated surfaces and remains visually stable', async () => {
    await page.getByRole('button', { name: 'New session' }).first().waitFor({ timeout: 30_000 })
    await page.getByText('Sentinel', { exact: true }).waitFor({ timeout: 10_000 })
    await page.getByRole('tree').first().waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: 'New folder' }).waitFor({ timeout: 10_000 })
    await page.getByLabel('Signed in as analyst@example.com').waitFor({ timeout: 10_000 })

    const sidebar = page.locator('button[aria-label="Collapse sidebar"]')
      .locator('xpath=ancestor::div[contains(@class, "_root")][1]')
    assert.equal(await sidebar.count(), 1, 'isolated sidebar root is mounted')
    await assertOrWriteScreenshot(sidebar, 'sidebar-expanded.png')

    const workspaceList = page.getByRole('tree').first()
    assert.match(await workspaceList.innerText(), /fixture/u)
    await assertOrWriteScreenshot(workspaceList, 'workspace-list.png')

    const search = page.getByRole('button', { name: 'Search sessions' }).first()
    await search.click()
    const searchInput = page.getByPlaceholder('Search sessions...')
    await searchInput.fill('fixture')
    await page.getByRole('tree', { name: 'Search results' }).waitFor({ timeout: 10_000 })
    assert.match(await page.getByRole('tree', { name: 'Search results' }).innerText(), /fixture/u)
    await searchInput.press('Escape')

    // The sidebar's New folder control intentionally skips the menu when it
    // has no alternate target. Exercise the conversation picker here, where
    // the standard hero workspace slot exposes the full menu/list flow.
    await page.getByRole('button', { name: 'New session' }).last().click()
    const workspaceChip = page.getByRole('button', { name: 'Choose folder (optional)' })
    await workspaceChip.waitFor({ timeout: 10_000 })
    await workspaceChip.click()
    const picker = page.getByRole('menu').last()
    await picker.waitFor({ timeout: 10_000 })
    assert.match(await picker.innerText(), /fixture/u)
    assert.match(await picker.innerText(), /project/u)
    await assertOrWriteScreenshot(picker, 'workspace-picker.png')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await page.getByRole('button', { name: 'Open sidebar' }).waitFor({ timeout: 10_000 })
    await page.waitForTimeout(250)
    const collapsedSidebar = page.locator('button[aria-label="Open sidebar"]')
      .locator('xpath=ancestor::div[contains(@class, "_root")][1]')
    assert.equal(await collapsedSidebar.count(), 1, 'isolated collapsed sidebar root is mounted')
    await assertOrWriteScreenshot(collapsedSidebar, 'sidebar-collapsed.png')

    const expectedBundles = [
      'dsh-soc-agent-client',
      'dsh-soc-agent-sidebar',
      'dsh-soc-agent-workspace',
      'dsh-soc-agent-brand',
      'dsh-soc-agent-admin',
      'dsh-soc-agent-action-policy',
      'dsh-soc-agent-attachments',
      'dsh-soc-agent-email-draft',
    ]
    for (const bundle of expectedBundles) {
      assert.ok(browserRequests.some(url => decodeURIComponent(url).includes(bundle)), `browser loaded ${bundle}`)
    }
    assert.deepEqual(
      browserRequests.filter(url => /dsh-client-ui-(?:sidebar|workspace)/u.test(decodeURIComponent(url))),
      [],
      'official sidebar/workspace bundles are not requested',
    )
    expect(failedRequests, `failed browser requests: ${failedRequests.join('\n')}`).toEqual([])
    expect(badResponses, `browser responses >= 400: ${badResponses.join('\n')}`).toEqual([])

    expect(tripwires.consoleErrors, `browser console errors: ${tripwires.consoleErrors.join('\n')}`).toEqual([])
    expect(tripwires.pageErrors, `browser page errors: ${tripwires.pageErrors.join('\n')}`).toEqual([])
    expect(warnings.pageErrors, `browser page errors: ${warnings.pageErrors.join('\n')}`).toEqual([])
    expect(warnings.warnings, `browser connection warnings: ${warnings.warnings.join('\n')}`).toEqual([])
  }, 60_000)
})
