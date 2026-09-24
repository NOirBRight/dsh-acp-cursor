/** Read-only history navigation acceptance; uses two existing lab conversations. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const url = new URL(process.env.DSH_GUI_URL ?? '')
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.port === '3082', 'Only lab 3082 is allowed')
const playwrightRoot = process.env.DSH_PLAYWRIGHT_PATH
assert(playwrightRoot, 'Set DSH_PLAYWRIGHT_PATH to an installed Playwright module path')
const { chromium } = createRequire(playwrightRoot)('playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_CHROME_PATH ?? '/usr/bin/chromium' })
const firstTitle = process.env.DSH_HISTORY_TITLE ?? 'Use the bash tool to'
const otherTitle = process.env.DSH_OTHER_TITLE ?? 'Reply with exactly the word'
const native = '[data-cursor-agent-native-turn]'
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, locale: 'en-US', storageState: process.env.DSH_E2E_STORAGE_STATE })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    // Lab may have an unrelated experimental sidebar incompatible with this Host.
    // Opt-in affects this browser only; the ACP bundle and server stay untouched.
    if (process.env.DSH_E2E_STOCK_SIDEBAR === '1') await page.route('**/plugins/**', async route => {
      if (!route.request().url().includes('dsh-t3-taskbar')) return route.continue()
      const response = await route.fetch()
      const source = await response.text()
      const marker = 'id: "dsh-t3-taskbar",\n\tfactory: (require) => {'
      assert(source.includes(marker), 'Expected experimental sidebar module')
      await route.fulfill({ response, body: source.replace(marker, marker + ' return {name:"dsh-t3-taskbar", apply(){}};') })
    })
    let hold = false
    let release
    const gate = new Promise(resolve => { release = resolve })
    let lastReadSessionId
    await page.route('**/api/plugin-rpc/cursor', async route => {
      const request = route.request().postDataJSON()
      if (request?.method !== 'plugin-rpc/cursor'
        || !['activity/read', 'activity/read-after'].includes(request.payload?.endpoint)) return route.continue()
      lastReadSessionId = request.payload.payload?.sessionId
      if (hold) await gate
      await route.continue().catch(() => {}) // navigation can cancel an in-flight read
    })
    async function openSession(title) {
      const item = page.getByText(title, { exact: true }).first()
      if (mobile && !await item.isVisible()) await page.getByRole('button', { name: 'Open sidebar', exact: true }).click()
      await item.click()
    }
    async function showActivity() {
      const section = page.locator(native).first()
      if (!await section.isVisible()) {
        const turn = page.getByRole('button', { name: /^(?:Took |Thought for )/ }).first()
        if (await turn.getAttribute('aria-expanded') !== 'true') await turn.click()
        const analysis = page.getByRole('button', { name: 'Analysis completed' }).first()
        if (await analysis.isVisible() && !await section.isVisible()) await analysis.click()
      }
      await section.waitFor({ state: 'visible', timeout: 3000 })
    }
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'New session', exact: true }).first().waitFor()
      await openSession(firstTitle)
      await page.locator(native).first().waitFor({ state: 'attached' })
      await showActivity()
      const before = await page.locator(native).allTextContents()
      assert(before.some(text => /Bash|Read|Think/.test(text)), 'Fixture must contain real native activity')
      const sessionId = lastReadSessionId
      assert(sessionId, 'Initial history must be loaded from the Host')
      await openSession(otherTitle)
      await page.waitForFunction(({ native, before }) => JSON.stringify([...document.querySelectorAll(native)].map(n => n.textContent)) !== JSON.stringify(before), { native, before })
      hold = true
      const resuming = page.waitForRequest(request => {
        if (new URL(request.url()).pathname !== '/api/plugin-rpc/cursor') return false
        const body = request.postDataJSON()
        return body?.method === 'plugin-rpc/cursor' && body.payload?.endpoint === 'activity/read-after'
          && body.payload?.payload?.sessionId === sessionId
      }, { timeout: 3000 })
      await openSession(firstTitle)
      // Host reads are held: this can succeed only with the retained browser history.
      await page.waitForFunction(({ native, before }) => JSON.stringify([...document.querySelectorAll(native)].map(n => n.textContent)) === JSON.stringify(before), { native, before }, { timeout: 3000 })
      await showActivity()
      const resumed = (await resuming).postDataJSON()
      assert(resumed.payload.endpoint === 'activity/read-after' && resumed.payload.payload.afterSeq > 0, 'Returning must not reread from zero')
      release()
      hold = false
      await page.waitForTimeout(1200)
      assert.deepEqual(await page.locator(native).allTextContents(), before, 'Catch-up must not duplicate history')
      assert.deepEqual(errors, [], 'No client rendering errors')
      console.log(`PASS ${mobile ? 'mobile 390px' : 'desktop'}: history restored while RPC held; incremental resume; no duplication`)
    } finally {
      release()
      await context.close()
    }
  }
} catch (error) {
  console.error(String(error).replace(/([?&]token=)[^\s"']+/g, '$1<REDACTED>'))
  process.exitCode = 1
} finally { await browser.close() }
