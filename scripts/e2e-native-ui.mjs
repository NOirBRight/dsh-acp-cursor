import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

// Existing GUI only. Login cookies stay in memory; never save HAR or storage state.
const { chromium } = await import(process.env.E2E_PLAYWRIGHT_MODULE ?? 'playwright')
const base = new URL(process.env.DSH_WEB_URL ?? 'http://127.0.0.1:3080')
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'local GUI only')
const authResponse = await fetch(process.env.E2E_AUTH_URL ?? 'http://127.0.0.1:3180/', { redirect: 'manual' })
assert.equal(authResponse.status, 302, 'existing login sidecar must provide a launch URL')
const auth = new URL(authResponse.headers.get('location'), base)
auth.host = base.host
const output = resolve(process.env.E2E_OUTPUT ?? '.scratch/native-ui-e2e')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_CHROME ?? '/usr/bin/google-chrome' })
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], locale: 'en-US', viewport: { width: 1440, height: 1100 } })
const page = await context.newPage()
page.setDefaultTimeout(20000)
const errors = []
page.on('pageerror', error => errors.push(error.name))
const stamp = process.env.E2E_SESSION_TITLE?.match(/\d+$/)?.[0] ?? Date.now()
const sessionTitle = process.env.E2E_SESSION_TITLE ?? `E2E native UI ${stamp}`
const fixture = `/tmp/dsh-native-e2e-${stamp}.txt`
const composer = page.getByRole('textbox', { name: /Describe what you want to build|Message or run a task/ })
const report = { origin: base.origin, sessionTitle, fixture, checks: [], screenshots: [] }
async function shot(locator, name) {
  await locator.screenshot({ path: resolve(output, name) })
  report.screenshots.push(name)
}
try {
  report.stage = 'check loaded GUI bundles'
  const nativeRequest = page.waitForResponse(response => new URL(response.url()).pathname === '/plugins/' && response.url().includes('dsh-acp-cursor/client.js'))
  const coreRequest = page.waitForResponse(response => new URL(response.url()).pathname === '/plugins/' && response.url().includes('dsh-client-ui-conversation/client.js'))
  assert.equal((await page.goto(auth.href, { waitUntil: 'domcontentloaded' })).status(), 200)
  const [nativeAsset, coreAsset] = await Promise.all([nativeRequest, coreRequest])
  await composer.waitFor()
  assert.equal(nativeAsset.status(), 200)
  assert.equal(coreAsset.status(), 200)
  const nativeCode = await nativeAsset.text()
  const coreCode = await coreAsset.text()
  assert(nativeCode.includes('data-native-io'), 'live GUI serves the classified tool cards')
  assert(!coreCode.includes('parkedDrafts'), 'withdrawn core draft patch is absent')
  for (const [kind, path, served] of [['plugin', process.env.E2E_EXPECT_PLUGIN, nativeCode], ['core', process.env.E2E_EXPECT_CORE, coreCode]]) {
    if (!path) continue
    const source = await readFile(path, 'utf8')
    assert(served.includes(source.replace(/\n\/\/# sourceMappingURL=.*$/u, '').trim()), `${kind} executable code matches the expected artifact`)
    report[`${kind}SHA256`] = createHash('sha256').update(source).digest('hex')
  }
  report.checks.push('Live GUI serves plugin layout fix without the withdrawn core patch')
  console.log('PASS live bundle checks')

  if (process.env.E2E_SESSION_TITLE) {
    report.stage = 'open existing fixture session'
    const search = page.getByPlaceholder('Search sessions...')
    if (!await search.isVisible()) await page.getByRole('button', { name: 'Search sessions', exact: true }).click()
    await search.fill(sessionTitle)
    await page.getByRole('treeitem').filter({ hasText: sessionTitle }).click()
    await search.fill('')
  } else {
    report.stage = 'create isolated native test session'
    await page.getByRole('button', { name: /^New session$/i }).last().click()
    await page.getByRole('button', { name: /^Select model/ }).click()
    await page.getByRole('menuitem', { name: /^Model/ }).click()
    await page.getByRole('menu').locator('section[aria-labelledby$="-cursor-agent"]').getByRole('menuitemradio', { name: 'Composer 2.5', exact: true }).click()
    await composer.click()
    await composer.fill(`This is an isolated UI E2E test. Do only these steps, using separate native tools: (1) create a TODO list for the test; (2) use Write to create ${fixture} containing exactly before\\nsecond line\\n; (3) use Read to read that file; (4) use Edit to replace before with after; (5) use Shell to run cat ${fixture}; (6) mark the TODOs completed. Do not inspect or change any other files. Final answer exactly E2E_NATIVE_DONE_${stamp}.`)
    report.stage = 'run native fixture tools'
    console.log('RUN real Cursor fixture tools')
    await composer.press('Enter')
    await page.locator('[data-native-tool-card]').first().waitFor({ timeout: 180000 })
    await page.waitForFunction(marker => document.querySelector('[data-turn-tail]') && document.body.innerText.includes(marker) && !document.querySelector('button[aria-label="Stop generating"]'), `E2E_NATIVE_DONE_${stamp}`, { timeout: 240000 })
    report.stage = 'rename test session'
    const selected = page.locator('[role="treeitem"][aria-selected="true"]')
    await selected.hover()
    await selected.getByRole('button').last().click()
    await page.getByRole('menuitem', { name: /Rename/ }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox').fill(sessionTitle)
    await dialog.getByRole('button', { name: /Save|Rename/ }).click()
  }

  report.stage = 'verify expanded tool cards'
  const processDisclosure = page.getByText('Thought for a while', { exact: true })
  if (await processDisclosure.count() && await processDisclosure.isVisible()) await processDisclosure.click()
  const cards = page.locator('[data-native-tool-card]')
  await cards.first().waitFor()
  for (const card of await cards.all()) await card.locator('[data-disclosure-row]').click()
  for (const [selector, name] of [['[data-read]', 'read.png'], ['[data-diff]', 'write.png'], ['[data-terminal]', 'terminal.png'], ['[data-native-io]', 'todo.png']]) {
    const body = cards.locator(selector).first()
    await body.waitFor()
    assert((await body.innerText()).length > 0, `${selector} has visible content`)
    await shot(body, name)
  }
  await shot(cards.locator('[data-diff]').last(), 'edit.png')
  assert.equal(await cards.locator('[data-native-download]').count(), 0, 'old two-payload layout is gone')
  assert((await cards.locator('[data-read]').first().innerText()).includes('before'), 'Read decodes file content')
  assert((await cards.locator('[data-diff]').last().innerText()).includes('after'), 'Edit displays replacement')
  assert((await cards.locator('[data-terminal]').last().innerText()).includes('after'), 'Shell displays output')
  const created = await cards.locator('[data-diff]').first().innerText()
  assert(!created.includes('-- /dev/null') && !created.includes('++ b/'), 'Write has no phantom header changes')
  const generic = cards.locator('[data-native-io]').first()
  await generic.locator('[data-native-copy]').first().click()
  assert((await page.evaluate(() => navigator.clipboard.readText())).includes('todos'), 'fallback input remains copyable')
  const readCard = cards.filter({ has: page.locator('[data-read]') }).first()
  await readCard.getByRole('button', { name: 'Inspect', exact: true }).click()
  assert((await readCard.locator('[data-native-io]').innerText()).includes('before'), 'Inspect retains the source payload')
  const toggle = readCard.locator('[data-disclosure-row]')
  await toggle.focus()
  await toggle.press('Enter')
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
  await toggle.press('Space')
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
  report.checks.push('Real file, diff, shell and TODO bodies; clean Write headers; copy, Inspect and keyboard disclosure')
  await page.setViewportSize({ width: 390, height: 844 })
  await shot(readCard, 'mobile-read.png')
  assert(await cards.evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().right <= innerWidth + 1)), 'cards fit the narrow viewport')
  report.checks.push('Classified cards fit a 390px viewport')
  assert.deepEqual(errors, [], 'no uncaught frontend exceptions')
  report.checks.push('No uncaught frontend exceptions')
  report.status = 'passed'
  console.log('PASS real native tool layouts')
} catch (error) {
  report.status = 'failed'
  report.failure = String(error.message).replace(/([?&]token=)[^\s&]+/g, '$1<REDACTED>').slice(0, 2000)
  console.error(report.stage, report.failure)
  process.exitCode = 1
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
