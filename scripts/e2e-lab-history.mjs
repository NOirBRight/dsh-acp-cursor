/** Read-only history navigation acceptance; uses two existing lab conversations. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const url = new URL(process.env.DSH_GUI_URL ?? '')
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.port === '3082', 'Only lab 3082 is allowed')
const playwrightRoot = process.env.DSH_PLAYWRIGHT_PATH ?? '/home/noirbright/.local/opt/dsh-staging/dsh-v0.1.2-rc.1-a66e470204/source/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.js'
const { chromium } = createRequire(playwrightRoot)('playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_CHROME_PATH ?? '/usr/bin/google-chrome' })
const firstTitle = process.env.DSH_HISTORY_TITLE ?? 'Use the bash tool to'
const otherTitle = process.env.DSH_OTHER_TITLE ?? 'Reply with exactly the word'
const native = '[data-cursor-agent-native-turn]'
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, locale: 'en-US' })
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
    const reads = []
    await page.route('**/dsh-acp-cursor/activity/**', async route => {
      const request = route.request().postDataJSON()
      reads.push({ method: request.method, ...request.payload, held: hold })
      if (hold) await gate
      await route.continue().catch(() => {}) // navigation can cancel an in-flight read
    })
    async function openSession(title) {
      const item = page.getByText(title, { exact: true }).first()
      if (!await item.isVisible()) {
        const toggle = page.getByRole('button', { name: /Open sidebar|Expand sidebar|Toggle sidebar/i }).first()
        await toggle.click()
      }
      await item.click()
    }
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'New session', exact: true }).first().waitFor()
      await openSession(firstTitle)
      await page.locator(native).first().waitFor({ state: 'attached' })
      const before = await page.locator(native).allTextContents()
      assert(before.some(text => /Bash|Read|Think/.test(text)), 'Fixture must contain real native activity')
      const sessionId = reads[0]?.sessionId
      assert(sessionId, 'Initial history must be loaded from the Host')
      await openSession(otherTitle)
      await page.waitForFunction(({ native, before }) => JSON.stringify([...document.querySelectorAll(native)].map(n => n.textContent)) !== JSON.stringify(before), { native, before })
      hold = true
      await openSession(firstTitle)
      // Host reads are held: this can succeed only with the retained browser history.
      await page.waitForFunction(({ native, before }) => JSON.stringify([...document.querySelectorAll(native)].map(n => n.textContent)) === JSON.stringify(before), { native, before }, { timeout: 3000 })
      const resumed = reads.filter(read => read.held && read.sessionId === sessionId)
      assert(resumed.length > 0, 'Returning must start incremental catch-up')
      assert(resumed.every(read => read.method === 'activity/read-after' && read.afterSeq > 0), 'Returning must not reread from zero')
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
