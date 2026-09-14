/** Real GUI regression on lab 3082. Restores changed catalog checkboxes; never logs out. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const url = new URL(process.env.DSH_GUI_URL ?? '')
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.port === '3082', 'Only the existing 3082 lab is allowed')
const playwrightRoot = process.env.DSH_PLAYWRIGHT_PATH ?? '/home/noirbright/.local/opt/dsh-staging/dsh-v0.1.2-rc.1-a66e470204/source/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.js'
const { chromium } = createRequire(playwrightRoot)('playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_CHROME_PATH ?? '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const choices = [/gpt-5[.]4-fast-1m/, /[(]composer-2[.]5[)]/, /[(]kimi-k3-1m[)]/, /[(]kimi-k3[)]/]
const expectedContext = {
  'composer-2.5': 200_000,
  'gpt-5.4-fast-1m': 1_000_000,
  'grok-4.6': 256_000,
  'grok-4.6-fast': 256_000,
  'kimi-k3': 200_000,
  'kimi-k3-1m': 1_000_000,
}
let original
let changed = false
async function detail() {
  await page.getByRole('button', { name: 'LLM Providers', exact: true }).click()
  await page.getByRole('button', { name: 'Agent', exact: true }).click()
  const row = page.getByRole('dialog').getByText('Cursor', { exact: true }).locator('xpath=ancestor::*[.//button[normalize-space(.)="Details"]][1]')
  await row.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('button', { name: 'Choose from account', exact: true }).waitFor()
}
async function picker() {
  await page.getByRole('button', { name: 'Choose from account', exact: true }).click({ timeout: 20000 })
  const popup = page.getByRole('dialog').last()
  await popup.getByRole('checkbox', { name: choices[0] }).waitFor({ timeout: 30000 })
  return popup
}
async function save(popup) {
  await popup.getByRole('button', { name: 'Apply', exact: true }).click()
  const button = page.getByRole('button', { name: 'Save', exact: true })
  await button.click()
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Save' && button.disabled))
}
try {
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click({ timeout: 20000 })
  await detail()
  await page.getByText('Cursor Models', { exact: true }).waitFor({ timeout: 40000 })
  await page.getByText('Other Models', { exact: true }).waitFor({ timeout: 40000 })
  const popup = await picker()
  assert(await page.getByRole('button', { name: 'Save', exact: true }).isDisabled(), 'Fetching must not adopt any models')
  assert(await popup.getByRole('checkbox', { name: /kimi-k3-1m/ }).count() > 0, 'Fetch must offer Kimi K3 Max')
  original = await Promise.all(choices.map(name => popup.getByRole('checkbox', { name }).first().isChecked()))
  for (const name of choices) await popup.getByRole('checkbox', { name }).first().check()
  changed = true
  await save(popup)
  const catalogRows = page.locator('[data-model-row]')
  const catalogCount = await catalogRows.count()
  assert.ok(catalogCount > 0, 'Saved catalog is empty')
  assert.ok(await catalogRows.locator('button[aria-expanded="true"]').count() < catalogCount, 'Fetch must not leave every row expanded')
  for (const [id, expected] of Object.entries(expectedContext)) {
    const row = page.locator('[data-model-row]').filter({ has: page.locator('input[value="' + id + '"]') })
    if (await row.count() === 0) continue
    const expand = row.locator('button[aria-expanded="false"]')
    if (await expand.count() > 0) await expand.click()
    const value = await row.getByLabel('Context window', { exact: true }).inputValue()
    assert.equal(Number(value), expected, 'Wrong context for ' + id)
  }
  await page.getByRole('dialog').screenshot({ path: '/tmp/acp-cursor-context.png' })
  await page.getByRole('button', { name: 'Model Switch', exact: true }).click()
  await page.getByRole('button', { name: /^Main model/ }).click()
  const selects = page.getByRole('dialog').getByRole('combobox')
  await selects.nth(0).selectOption('cursor-agent')
  const models = await selects.nth(1).locator('option').evaluateAll(nodes => nodes.map(node => node.value))
  assert(models.includes('gpt-5.4-fast-1m') && models.includes('composer-2.5'), 'Saved native models must enter the Host catalog without reloading')
  await page.screenshot({ path: '/tmp/acp-cursor-model-switch.png' })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /^Select model/ }).first().click()
  await page.getByRole('menuitem', { name: /^Model/ }).click()
  const nativeGroup = page.getByRole('menu').locator('section[aria-labelledby$="-cursor-agent"]')
  assert.equal(await nativeGroup.locator('div[id$="-cursor-agent"]').innerText(), 'Cursor')
  assert.equal(await nativeGroup.locator('svg.pu-logo').first().getAttribute('viewBox'), '0.24 -1.44 23.6 26.88')
  assert(await nativeGroup.getByRole('menuitemradio', { name: /^GPT-5[.]4/ }).count() > 0)
  assert(await nativeGroup.getByRole('menuitemradio', { name: 'Composer 2.5', exact: true }).count() > 0)
  await nativeGroup.locator('div[id$="-cursor-agent"]').scrollIntoViewIfNeeded()
  await page.getByRole('menu').screenshot({ path: '/tmp/acp-cursor-composer.png' })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  assert.deepEqual(errors, [], 'No client rendering errors')
  console.log('PASS: both quota windows, selection overlay without adoption, saved Fast Max + Composer in Host Model Switch')
} finally {
  try {
    if (changed && original) {
      if (await page.getByRole('button', { name: 'LLM Providers', exact: true }).count() === 0) await page.getByRole('button', { name: 'Settings', exact: true }).first().click()
      await detail()
      const popup = await picker()
      for (let index = 0; index < choices.length; index++) await popup.getByRole('checkbox', { name: choices[index] }).first().setChecked(original[index])
      await save(popup)
      console.log('Restored original catalog choices; account credentials were not changed')
    }
  } finally { await browser.close() }
}
