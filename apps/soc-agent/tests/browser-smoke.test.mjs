import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  launchWebScaffold,
  watchConsole,
} from '../../../vendor/deepseek-harness/apps/web/tests/scaffold.ts'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const socPatch = join(repoRoot, 'apps/soc-agent/cordis.patch.yml')
const fixtureAuthHost = join(repoRoot, 'apps/soc-agent/tests/fixture-auth-host.mjs')
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
    throw new Error(`missing browser screenshot ${path}; run UPDATE_SOC_SCREENSHOTS=1 pnpm --filter dsh-soc-agent test:browser`)
  }
  if (actual.length !== expected.length || !actual.equals(expected)) {
    throw new Error(
      `browser screenshot changed: ${path} (expected ${expected.length} bytes, got ${actual.length})`,
    )
  }
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
    // Keep the product patch intact while omitting its Python MCP child for
    // this browser-only lane; fixture data supplies the client state and the
    // browser contract under test does not need a live external process.
    browserOverlayHome = await mkdtemp(join(tmpdir(), 'dsh-soc-browser-overlay-'))
    const browserPatch = join(browserOverlayHome, 'cordis.patch.yml')
    await writeFile(browserPatch, `${await readFile(socPatch, 'utf8')}
- id: soc-agent-mcp
  disabled: true
- id: splunk-official-mcp
  disabled: true
- id: soc-agent-auth-host
  disabled: true
- id: soc-agent-admin-host
  disabled: true
- insert:
    - id: soc-browser-fixture-auth
      name: ${JSON.stringify(pathToFileURL(fixtureAuthHost).href)}
`)
    const profileModules = join(harnessHome, 'profiles', 'scaffold', 'node_modules')
    await mkdir(profileModules, { recursive: true })
    await symlink(join(repoRoot, 'apps/soc-agent'), join(profileModules, 'dsh-soc-agent'), 'dir')
    scaffold = await launchWebScaffold({
      extraInstallAnchors: [join(repoRoot, 'apps/soc-agent/package.json')],
      extraOverlayPath: browserPatch,
      harnessHome,
    })
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
    // Establish the Harness index session through the real one-time browser
    // token, then load fixture mode with the resulting HttpOnly cookie.
    await page.goto(scaffold.ctx.connection.authenticatedUrl(scaffold.baseUrl), { waitUntil: 'load' })
    await page.goto(`${scaffold.baseUrl}/?fixture&fixtureInteraction=approval`, { waitUntil: 'load' })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
    if (harnessHome !== undefined) await rm(harnessHome, { recursive: true, force: true })
    if (browserOverlayHome !== undefined) await rm(browserOverlayHome, { recursive: true, force: true })
  })

  it('mounts isolated surfaces and remains visually stable', async () => {
    try {
      await page.getByRole('button', { name: 'New session' }).first().waitFor({ timeout: 30_000 })
    } catch (error) {
      const body = (await page.locator('body').innerText()).slice(0, 4_000)
      throw new Error([
        String(error),
        `url: ${page.url()}`,
        `body:\n${body}`,
        `console errors:\n${tripwires.consoleErrors.join('\n')}`,
        `page errors:\n${tripwires.pageErrors.join('\n')}`,
        `failed requests:\n${failedRequests.join('\n')}`,
        `bad responses:\n${badResponses.join('\n')}`,
      ].join('\n\n'))
    }
    try {
      await page.getByText('Sentinel', { exact: true }).waitFor({ timeout: 10_000 })
    } catch (error) {
      throw new Error([
        String(error),
        `body:\n${(await page.locator('body').innerText()).slice(0, 4_000)}`,
        `SOC requests:\n${browserRequests.filter(url => decodeURIComponent(url).includes('dsh-soc-agent')).join('\n')}`,
        `console errors:\n${tripwires.consoleErrors.join('\n')}`,
        `page errors:\n${tripwires.pageErrors.join('\n')}`,
      ].join('\n\n'))
    }
    await page.getByRole('tree').first().waitFor({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Add workspace' }).waitFor({ timeout: 10_000 })
    await page.getByLabel('Signed in as analyst@example.com').waitFor({ timeout: 10_000 })
    const continueNotice = page.getByRole('button', { name: 'Continue' })
    if (await continueNotice.isVisible()) await continueNotice.click()

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

    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await page.getByRole('button', { name: 'Open sidebar' }).waitFor({ timeout: 10_000 })
    await page.waitForTimeout(250)
    const collapsedSidebar = page.locator('button[aria-label="Open sidebar"]')
      .locator('xpath=ancestor::div[contains(@class, "_root")][1]')
    assert.equal(await collapsedSidebar.count(), 1, 'isolated collapsed sidebar root is mounted')
    await assertOrWriteScreenshot(collapsedSidebar, 'sidebar-collapsed.png')
    await page.getByRole('button', { name: 'Open sidebar' }).click()
    await page.getByRole('button', { name: 'Collapse sidebar' }).waitFor({ timeout: 10_000 })

    // The fixture starts with a resident session but the shell intentionally
    // opens in its no-session hero. Select the resident session before taking
    // conversation, approval, attachment, and auto-collapse snapshots.
    const fixtureSession = page.getByRole('treeitem', { name: /Fixture 历史会话/u }).first()
    await fixtureSession.click()
    await fixtureSession.waitFor({ state: 'attached', timeout: 10_000 })

    const conversation = page.locator('[data-conversation-scroll]').first()
    await conversation.waitFor({ timeout: 10_000 })
    await assertOrWriteScreenshot(conversation, 'conversation.png')

    const approval = page.locator('[data-approval-scroll]').first()
    await approval.waitFor({ timeout: 10_000 })
    await assertOrWriteScreenshot(approval, 'approval.png')

    const attachments = page.locator('[data-message-attachments]').first()
    await attachments.waitFor({ timeout: 10_000 })
    await assertOrWriteScreenshot(attachments, 'attachments.png')

    const autoCollapse = page.getByRole('status').filter({ hasText: 'Deep sleeping...' }).first()
    await autoCollapse.waitFor({ timeout: 10_000 })
    await assertOrWriteScreenshot(autoCollapse, 'auto-collapse.png')

    // The sidebar's Add workspace control intentionally skips the menu when it
    // has no alternate target. Exercise the conversation picker here, where
    // the standard hero workspace slot exposes the full menu/list flow.
    await page.getByRole('button', { name: 'New session' }).last().click()
    const workspaceChip = page.getByRole('button', { name: 'Choose workspace' })
    await workspaceChip.waitFor({ timeout: 10_000 })
    await workspaceChip.click()
    const picker = page.getByRole('menu').last()
    await picker.waitFor({ timeout: 10_000 })
    assert.match(await picker.innerText(), /fixture/u)
    assert.match(await picker.innerText(), /project/u)
    await assertOrWriteScreenshot(picker, 'workspace-picker.png')
    await page.keyboard.press('Escape')

    const expectedBundles = [
      'dsh-soc-agent-action-policy',
      'dsh-soc-agent-admin',
      'dsh-soc-agent-api-gateway',
      'dsh-soc-agent-api-remotes',
      'dsh-soc-agent-api-workspace-files',
      'dsh-soc-agent-attachments',
      'dsh-soc-agent-auto-collapse',
      'dsh-soc-agent-brand',
      'dsh-soc-agent-client',
      'dsh-soc-agent-connection',
      'dsh-soc-agent-email-draft',
      'dsh-soc-agent-file-upload',
      'dsh-soc-agent-session-controller',
      'dsh-soc-agent-session-log-export',
      'dsh-soc-agent-sidebar',
      'dsh-soc-agent-ui-approval',
      'dsh-soc-agent-ui-chat',
      'dsh-soc-agent-ui-commands',
      'dsh-soc-agent-ui-conversation',
      'dsh-soc-agent-ui-input-trigger',
      'dsh-soc-agent-ui-layout',
      'dsh-soc-agent-ui-model-selection',
      'dsh-soc-agent-ui-renderer',
      'dsh-soc-agent-ui-session',
      'dsh-soc-agent-workspace',
      'dsh-soc-agent-workspace-controller',
    ]
    for (const bundle of expectedBundles) {
      assert.ok(browserRequests.some(url => decodeURIComponent(url).includes(bundle)), `browser loaded ${bundle}`)
    }
    const decodedRequests = browserRequests.map(url => decodeURIComponent(url))
    assert.deepEqual(
      decodedRequests.filter(url => [
        '@deepseek-ai/dsh-client-ui-sidebar/client.js',
        '@deepseek-ai/dsh-client-ui-workspace/client.js',
        '@deepseek-ai/dsh-client-ui-directory-picker-browse/client.js',
        '@deepseek-ai/dsh-client-ui-directory-picker-native/client.js',
      ].some(bundle => url.includes(bundle))),
      [],
      'disabled official root and directory-picker bundles are not requested',
    )
    expect(failedRequests, `failed browser requests: ${failedRequests.join('\n')}`).toEqual([])
    expect(badResponses, `browser responses >= 400: ${badResponses.join('\n')}`).toEqual([])

    expect(tripwires.consoleErrors, `browser console errors: ${tripwires.consoleErrors.join('\n')}`).toEqual([])
    expect(tripwires.pageErrors, `browser page errors: ${tripwires.pageErrors.join('\n')}`).toEqual([])
    expect(warnings.pageErrors, `browser page errors: ${warnings.pageErrors.join('\n')}`).toEqual([])
    expect(warnings.warnings, `browser connection warnings: ${warnings.warnings.join('\n')}`).toEqual([])
  }, 60_000)
})
