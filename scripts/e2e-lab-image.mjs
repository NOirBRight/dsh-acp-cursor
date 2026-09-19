/** Lab 3082: attach a unique image to CursorAgent and require the model to read its text. */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const url = new URL(process.env.DSH_GUI_URL ?? '')
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.port === '3082', 'Only the existing 3082 lab is allowed')

const MARKER = 'ACP-IMG-E2E-7K2M'
const playwrightRoot = process.env.DSH_PLAYWRIGHT_PATH ?? '/home/noirbright/.local/opt/dsh-staging/dsh-v0.1.2-rc.1-a66e470204/source/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.js'
const { chromium } = createRequire(playwrightRoot)('playwright')

const pngPath = join(tmpdir(), 'acp-cursor-e2e-image.png')
const rendered = spawnSync('python3', ['-c', `
from PIL import Image, ImageDraw, ImageFont
img = Image.new('RGB', (900, 240), (12, 28, 68))
draw = ImageDraw.Draw(img)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 64)
draw.text((40, 80), '${MARKER}', fill=(255, 255, 255), font=font)
img.save('${pngPath}')
`], { encoding: 'utf8' })
assert.equal(rendered.status, 0, 'Failed to render the E2E fixture: ' + rendered.stderr)

const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_CHROME_PATH ?? '/usr/bin/google-chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const log = (...parts) => console.log('•', ...parts)
const conversation = () => page.locator('body').innerText()
const composerBox = () => page.getByRole('textbox', { name: /Describe what you want to build|Message or run a task/ })

async function composerHandle() {
  if (await composerBox().count() > 0) return composerBox()
  const editor = page.locator('[contenteditable="true"], textarea').last()
  if (await editor.count() > 0) return editor
  await page.screenshot({ path: '/tmp/acp-image-composer-missing.png' })
  throw new Error('Composer unavailable')
}

async function approveIfAsked(timeout = 3000) {
  const allow = page.getByRole('button', { name: 'Allow once', exact: true })
  try { await allow.click({ timeout }); log('approved one native permission request') } catch { /* none requested */ }
}

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

const CURSOR_TRIGGER = /Composer 2[.]5|Cursor Grok|Claude Fable|Kimi K3|GPT-5[.]4|GPT-5[.]6/

async function modelTitle() {
  return page.getByRole('button', { name: /^Select model/ }).first().getAttribute('title')
}

async function openSettings(section) {
  if (await page.getByRole('button', { name: section, exact: true }).count() === 0) {
    await page.getByRole('button', { name: 'Settings', exact: true }).first().click({ timeout: 20000 })
  }
  await page.getByRole('button', { name: section, exact: true }).click()
}

async function saveMainModel(provider, model) {
  await openSettings('Model Switch')
  await page.getByRole('button', { name: /^Main model/ }).click()
  const dialog = page.getByRole('dialog')
  const selects = dialog.getByRole('combobox')
  await selects.nth(0).waitFor({ timeout: 10000 })
  await selects.nth(0).selectOption(provider).catch(() => undefined)
  await selects.nth(1).selectOption(model)
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
}

async function waitForCursorSession() {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    const toast = await page.getByRole('alert').innerText().catch(() => '')
    if (toast) log('session toast', JSON.stringify(toast.slice(0, 400)))
    const title = await modelTitle()
    log('model trigger', JSON.stringify(title))
    if (CURSOR_TRIGGER.test(String(title))) return
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: '/tmp/acp-image-model-stuck.png' })
  assert.match(String(await modelTitle()), CURSOR_TRIGGER, 'New lab session did not start on CursorAgent')
}

async function attachPng(path) {
  const bytes = [...new Uint8Array(await readFile(path))]
  await page.evaluate(({ bytes, name }) => {
    const file = new File([new Uint8Array(bytes)], name, { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    document.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    const composer = document.querySelector('textarea')
    composer?.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
  }, { bytes, name: 'acp-e2e.png' })
  await page.getByRole('img', { name: 'acp-e2e.png' }).waitFor({ timeout: 10000 })
  log('attached acp-e2e.png')
}

let restoreMain = false
try {
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5500)
  log('page loaded; pageerrors', errors.length)
  await page.locator('div.dsht3-card[role="button"]').filter({ hasText: 'Workstationtest' }).click({ timeout: 10000 })
  await page.waitForTimeout(2000)
  log('opened titled session; trigger', JSON.stringify(await modelTitle()), 'intoUnknown', await page.getByText('Into the Unknown').count())
  await saveMainModel('cursor-agent', 'composer-2.5')
  restoreMain = true
  log('saved Cursor Composer as the lab Main model default')
  await page.getByRole('button', { name: 'New session' }).first().click()
  await page.waitForTimeout(2000)
  await waitForCursorSession()
  await waitIdle()
  const composer = await composerHandle()
  await composer.click()
  await attachPng(pngPath)
  await page.screenshot({ path: '/tmp/acp-image-attached.png' })
  const prompt = 'Read the large white text in this image. Reply with exactly that text and nothing else.'
  await composer.fill('')
  await composer.type(prompt, { delay: 2 })
  const send = page.getByRole('button', { name: 'Send message', exact: true }).last()
  log('send enabled', await send.isEnabled(), 'count', await page.getByRole('button', { name: /Send message|发送消息/ }).count())
  await send.click()
  const stop = page.getByRole('button', { name: 'Stop generating' })
  try {
    await stop.waitFor({ timeout: 12000 })
    log('turn started')
  } catch {
    await page.keyboard.press('Enter')
    try { await stop.waitFor({ timeout: 8000 }); log('turn started after Enter') }
    catch {
      const toast = await page.getByRole('alert').innerText().catch(() => '')
      log('send toast', JSON.stringify(toast.slice(0, 500)))
      await page.screenshot({ path: '/tmp/acp-image-send-failed.png' })
      throw new Error('Composer 2.5 did not start a turn. Toast: ' + toast.slice(0, 300))
    }
  }
  const deadline = Date.now() + 200000
  let matched = false
  while (Date.now() < deadline) {
    await approveIfAsked(1200)
    const text = await conversation().catch(() => '')
    if (text.includes(MARKER)) { matched = true; break }
    await page.waitForTimeout(1500)
  }
  await waitIdle()
  await page.screenshot({ path: '/tmp/acp-image-reply.png' })
  await mkdir('/tmp', { recursive: true })
  await writeFile('/tmp/acp-image-transcript.txt', await conversation())
  assert.equal(matched, true, 'Native turn did not echo the image marker ' + MARKER)
  assert.equal(errors.length, 0, 'No client rendering errors: ' + errors.join('; '))
  console.log('PASS: CursorAgent on 3082 read the attached image text ' + MARKER)
} finally {
  try {
    if (restoreMain) {
      await saveMainModel('deepseek-official', 'deepseek-flash')
      log('restored DeepSeek as the lab Main model default')
    }
  } catch (error) {
    log('restore main model failed', error instanceof Error ? error.message : String(error))
  }
  await browser.close()
}
