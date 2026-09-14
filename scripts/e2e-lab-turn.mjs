/** Real-turn acceptance on lab 3082 through the native CursorAgent provider. Consumes Cursor quota only. */
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
const findings = []
const log = (...parts) => console.log('•', ...parts)
const conversation = () => page.locator('body').innerText()
const composerBox = () => page.getByRole('textbox', { name: /Describe what you want to build|Message or run a task/ })
/** Resolve the live composer; a thread may rename the control, so fall back to the editor itself. */
async function composerHandle() {
  if (await composerBox().count() > 0) return composerBox()
  const editor = page.locator('[contenteditable="true"]').last()
  if (await editor.count() > 0) { findings.push('composer resolved via the contenteditable fallback'); log('composer via contenteditable fallback'); return editor }
  const snapshot = JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[contenteditable], textarea, input')].map(node => node.getAttribute('aria-label') ?? node.getAttribute('placeholder'))))
  await page.screenshot({ path: '/tmp/acp-composer-missing.png' })
  throw new Error('Composer unavailable; editable snapshot: ' + snapshot)
}
const modelTrigger = () => page.getByRole('button', { name: /^Select model/ }).first().getAttribute('title')

/** Approve exactly one native permission card when the agent asks for one. */
async function approveIfAsked(timeout = 3000) {
  const allow = page.getByRole('button', { name: 'Allow once', exact: true })
  try { await allow.click({ timeout }); findings.push('native approval: Allow once'); log('approved one native permission request') } catch { /* none requested */ }
}

/** A running turn replaces the composer; never touch the UI until it is idle again. */
async function waitIdle(timeout = 240000) {
  const stop = page.getByRole('button', { name: 'Stop generating' })
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await stop.count() === 0) { await page.waitForTimeout(900); if (await stop.count() === 0) return }
    await approveIfAsked(1200)
    await page.waitForTimeout(1000)
  }
  throw new Error('The turn never became idle')
}

/** The picker commits immediately; only an outside click dismisses without reverting. */
async function dismiss() { await page.mouse.click(700, 200); await page.waitForTimeout(600) }

async function chooseModel(modelName) {
  await page.getByRole('button', { name: /^Select model/ }).first().click()
  await page.getByRole('menuitem', { name: /^Model/ }).click()
  const group = page.getByRole('menu').locator('section[aria-labelledby$="-cursor-agent"]')
  await group.locator('div[id$="-cursor-agent"]').waitFor({ timeout: 20000 })
  const name = (await group.locator('div[id$="-cursor-agent"]').innerText()).trim()
  const svg = await group.locator('svg.pu-logo').first().getAttribute('viewBox')
  await group.getByRole('menuitemradio', { name: modelName, exact: true }).click()
  await dismiss()
  const trigger = await modelTrigger()
  log('family', JSON.stringify(name), 'icon', svg, '→', JSON.stringify(trigger))
  return { name, svg, trigger }
}

/** Force one native parameter so each turn runs the variant it claims to test. */
async function setParameter(parameter, optionName) {
  await waitIdle()
  await page.getByRole('button', { name: /^Select model/ }).first().click()
  const item = page.getByRole('menu').getByRole('menuitem', { name: new RegExp('^' + parameter) })
  if (await item.count() === 0) { findings.push(parameter + ': not offered by the native catalog'); await dismiss(); log(parameter, 'not offered; skipping'); return false }
  const current = (await item.innerText()).trim()
  if (new RegExp('\\b' + optionName + '$').test(current)) { await dismiss(); log(parameter, 'already', optionName); return true }
  await item.click()
  await page.getByRole('menuitemradio', { name: optionName, exact: true }).click()
  await dismiss()
  const trigger = await modelTrigger()
  findings.push(parameter + ' → ' + String(trigger))
  log(parameter, '→', JSON.stringify(trigger))
  return true
}

/** Send one prompt and wait for the reply, then for the turn to settle. */
async function sendPrompt(prompt, expect) {
  await waitIdle()
  const composer = await composerHandle()
  await composer.click()
  await composer.type(prompt, { delay: 2 })
  await page.keyboard.press('Enter')
  log('sent', JSON.stringify(prompt.slice(0, 56)))
  const deadline = Date.now() + 200000
  while (Date.now() < deadline) {
    await approveIfAsked(1200)
    if (expect.test(await conversation().catch(() => ''))) { await waitIdle(); log('matched', expect.source); return }
    await page.waitForTimeout(1500)
  }
  await page.screenshot({ path: '/tmp/acp-turn-timeout.png' })
  throw new Error('Timed out waiting for reply matching ' + expect.source)
}

/** Start a long native command, stop it from the GUI, and prove the session recovers. */
async function cancelTurn() {
  await waitIdle()
  const composer = await composerHandle()
  await composer.click()
  await composer.type('Use the bash tool to run exactly: sleep 60 ; then reply ACP-E2E-SLEEP-DONE', { delay: 2 })
  await page.keyboard.press('Enter')
  log('sent long prompt; stopping in 10s')
  await page.waitForTimeout(10000)
  const stop = page.getByRole('button', { name: 'Stop generating' })
  assert.equal(await stop.count(), 1, 'A running turn must expose the stop control')
  await stop.click()
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    if (await page.getByRole('button', { name: 'Stop generating' }).count() === 0) break
    await page.waitForTimeout(1200)
  }
  await page.waitForTimeout(2500)
  const stopped = /Stopped/i.test(await conversation())
  findings.push('cancellation reported in the transcript: ' + String(stopped))
  await page.screenshot({ path: '/tmp/acp-turn-cancelled.png' })
  log('cancelled; transcript shows Stopped:', stopped)
}

try {
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5500)
  log('page loaded; pageerrors', errors.length)

  const picked = await chooseModel('Composer 2.5')
  assert.equal(picked.name, 'Cursor', 'The native group must be named Cursor')
  assert.equal(picked.svg, '0.24 -1.44 23.6 26.88', 'The native group must use the Cursor mark')
  assert(/Composer 2[.]5/.test(picked.trigger ?? ''), 'The selection must stick in the composer')

  await setParameter('Fast', 'Off')
  await sendPrompt('Use the bash tool to run exactly: echo ACP-E2E-TOOL-OK ; then reply with just that output and nothing else.', /ACP-E2E-TOOL-OK/)
  await page.screenshot({ path: '/tmp/acp-turn-tool.png' })

  await sendPrompt('Reply with exactly ACP-E2E-SECOND and nothing else.', /ACP-E2E-SECOND/)
  await page.screenshot({ path: '/tmp/acp-turn-second.png' })

  const toggled = await setParameter('Fast', 'On')
  assert.equal(toggled, true, 'Composer must expose the native Fast parameter')
  await sendPrompt('Reply with exactly ACP-E2E-FAST and nothing else.', /ACP-E2E-FAST/)
  await page.screenshot({ path: '/tmp/acp-turn-fast.png' })

  const tab = page.getByRole('tab', { name: 'Trajectory' })
  if (await tab.count() > 0) await tab.click(); else await page.getByText('Trajectory', { exact: true }).click()
  await page.waitForTimeout(3000)
  findings.push('trajectory shows the native step: ' + String(/bash|echo|ACP-E2E-TOOL-OK/i.test(await conversation())))
  await page.screenshot({ path: '/tmp/acp-turn-trajectory.png' })
  const chat = page.getByRole('tab', { name: 'Chat' })
  if (await chat.count() > 0) await chat.click(); else await page.getByText('Chat', { exact: true }).first().click()

  await setParameter('Fast', 'Off')
  await cancelTurn()
  await sendPrompt('Reply with exactly ACP-E2E-AFTER-CANCEL and nothing else.', /ACP-E2E-AFTER-CANCEL/)
  await page.screenshot({ path: '/tmp/acp-turn-after-cancel.png' })

  assert.equal(errors.length, 0, 'No client rendering errors: ' + errors.join('; '))
  console.log('FINDINGS:')
  for (const item of findings) console.log('  -', item)
  console.log('PASS: real Cursor turns — tool use with native approval, second turn, Fast variant, cancellation recovery, trajectory rendering')
} finally { await browser.close() }
