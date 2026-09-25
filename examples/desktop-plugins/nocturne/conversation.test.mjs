import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, symlink, writeFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const slot = name => `[data-slot="${name}"]`

test('Paper conversation renders real stored messages with readable surfaces and compact native composer', { timeout: 120000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nocturne-conversation-'))
  const home = join(dir, 'home')
  await mkdir(home, { recursive: true })
  await symlink(root, join(home, 'hermes-agent'))
  await writeFile(join(home, 'config.yaml'), 'model:\n  default: test-model\n  provider: custom:nocturne-test\nauxiliary:\n  title_generation:\n    enabled: false\nproviders:\n  nocturne-test:\n    api: http://127.0.0.1:9/v1\n    transport: chat_completions\n    default_model: test-model\n    key_env: NOCTURNE_TEST_API_KEY\n')
  for (const id of ['composer-resize', 'clean-new-chat', 'plum-composer', 'nocturne']) {
    await mkdir(join(home, 'desktop-plugins', id), { recursive: true })
    await copyFile(join(root, 'examples/desktop-plugins', id, 'plugin.js'), join(home, 'desktop-plugins', id, 'plugin.js'))
  }
  if (process.env.HERMES_TEST_WALLPAPER_PLUGIN) {
    await mkdir(join(home, 'desktop-plugins/hermes-wallpaper'), { recursive: true })
    await copyFile(process.env.HERMES_TEST_WALLPAPER_PLUGIN, join(home, 'desktop-plugins/hermes-wallpaper/plugin.js'))
  }
  // Explicit synthetic fixture in the isolated DB, never a real chat or model request.
  const seeded = spawnSync(process.env.HERMES_TEST_PYTHON || join(root, 'venv/bin/python'), ['-c', `
import json
from hermes_state import SessionDB
db = SessionDB()
sid = 'nocturne-conversation-fixture'
db.create_session(sid, source='cli', model='test-model')
db.set_session_title(sid, 'Nocturne visual fixture')
for i in range(8):
    db.append_message(sid, 'user', f'Previous message {i}')
    db.append_message(sid, 'assistant', ('Earlier answer for scroll verification. ' * 20))
db.append_message(sid, 'user', 'да, отлично, имплементируй')
db.append_message(sid, 'assistant', tool_calls=[{'id':'fixture-read', 'type':'function', 'function':{'name':'read_file', 'arguments':json.dumps({'path':'plugin.js'})}}, {'id':'fixture-test', 'type':'function', 'function':{'name':'terminal', 'arguments':json.dumps({'command':'node --test'})}}])
db.append_message(sid, 'tool', 'Fixture file contents', tool_name='read_file', tool_call_id='fixture-read')
db.append_message(sid, 'tool', 'Fixture test output', tool_name='terminal', tool_call_id='fixture-test')
db.append_message(sid, 'assistant', '## Nocturne готов.\\n\\nДизайн из Paper реализован. Это тестовая переписка для проверки оформления.\\n\\n- Двухуровневый ввод и мягкое затемнение.\\n- Меню модели и вложений остаются под рукой.\\n\\n[Документация](https://hermes-agent.nousresearch.com/docs/)')
db.close()
`], { cwd: root, env: { ...process.env, HOME: dir, HERMES_REAL_HOME: dir, HERMES_HOME: home }, encoding: 'utf8' })
  assert.equal(seeded.status, 0, seeded.stderr)
  const app = await electron.launch({
    executablePath: process.env.HERMES_TEST_APP || join(root, 'apps/desktop/release/linux-unpacked/Hermes'),
    args: [`--user-data-dir=${join(dir, 'userdata')}`, '--disable-setuid-sandbox', '--ozone-platform=headless', '--disable-gpu'],
    env: { ...process.env, HOME: dir, HERMES_REAL_HOME: dir, HERMES_HOME: home, NOCTURNE_TEST_API_KEY: 'test-only-not-a-real-credential', HERMES_DESKTOP_ISOLATED_BACKEND: '1', HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1' }, timeout: 60000
  })
  try {
    const page = await app.firstWindow()
    page.setDefaultTimeout(15000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 960))
    await page.getByText('Nocturne visual fixture', { exact: true }).first().waitFor({ state: 'visible', timeout: 60000 })
    await page.evaluate(path => {
      localStorage.setItem('hermes-desktop-mode-v1', 'dark')
      localStorage.setItem('hermes-desktop-theme-v2', 'mono')
      if (path) localStorage.setItem('hermes.plugin.hermes-wallpaper.settings', JSON.stringify({ enabled: true, path, glass: 100, dim: 0, blur: 0, fit: 'cover', dither: { on: false }, fx: { vignette: 0, frost: 0, bloom: 0, posterize: 0, duotone: { on: false } } }))
    }, process.env.HERMES_TEST_WALLPAPER)
    await page.reload()
    console.log('Fixture home', home)
    await page.getByText('Nocturne visual fixture', { exact: true }).first().click({ timeout: 45000 })
    const chat = page.locator('[data-chat-surface]:visible').first()
    await chat.locator(slot('aui_assistant-message-content')).last().waitFor({ state: 'visible', timeout: 45000 })
    await page.waitForFunction(() => !!document.getElementById('nocturne-style'))
    const hideSidebar = page.getByRole('button', { name: 'Hide sidebar', exact: true })
    if (await hideSidebar.count()) await hideSidebar.click()
    await page.waitForTimeout(500)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 960))
    const input = chat.locator(slot('composer-rich-input')).last()
    const surface = chat.locator(slot('composer-surface')).last()
    const bubble = chat.locator('.composer-human-message').last()
    const styleOf = locator => locator.evaluate(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect()
      return { background: s.backgroundColor, image: s.backgroundImage, color: s.color, fontSize: s.fontSize, lineHeight: s.lineHeight, height: r.height, width: r.width, x: r.x, y: r.y }
    })
    console.log('Artifacts', dir)
    await page.screenshot({ path: join(dir, 'conversation-before.png') })
    assert.equal((await styleOf(bubble)).background, 'rgb(43, 32, 45)', 'Real stored user bubble must use approved Paper plum surface')
    assert.match((await styleOf(chat)).image, /linear-gradient/, 'Reading scrim is per chat, not a global overlay over other panes')
    const composer = await styleOf(surface)
    assert.ok(composer.height >= 116 && composer.height < 164, 'Conversation composer is compact but keeps two action rows')
    assert.equal(await surface.locator('[aria-hidden]').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(36, 25, 35)')
    assert.equal((await styleOf(input)).fontSize, '17px')
    console.log('PASS conversation palette and geometry', JSON.stringify(composer))
    // Exercise native controls with real pointer/keyboard input, not synthetic DOM widgets.
    await input.click({ timeout: 45000 })
    await input.fill('Draft stays here\nSecond line')
    assert.match(await input.innerText(), /Draft stays here\s+Second line/)
    await chat.locator('[data-tour="model-pill"]').click()
    await page.locator('[data-slot="dropdown-menu-content"], [role="dialog"]').first().waitFor({ state: 'visible' })
    await page.keyboard.press('Escape')
    await chat.getByRole('button', { name: 'Add context', exact: true }).click()
    await page.getByRole('menu').waitFor({ state: 'visible' })
    await page.keyboard.press('Escape')
    await input.fill('')
    const summary = chat.locator('[data-tool-summary] button[aria-expanded]').last()
    await summary.click()
    assert.equal(await summary.getAttribute('aria-expanded'), 'true')
    const tool = chat.locator('[data-tool-row]').filter({ hasText: 'Ran node --test' }).locator('button[aria-expanded]').first()
    await tool.click()
    assert.equal(await tool.getAttribute('aria-expanded'), 'true')
    await chat.getByText('$ node --test', { exact: true }).waitFor({ state: 'visible' })
    await page.screenshot({ path: join(dir, 'expanded-tool.png') })
    await tool.click()
    await summary.click()
    assert.equal(await summary.getAttribute('aria-expanded'), 'false')
    console.log('PASS native input, menus, tool expansion and collapse')
    const viewport = chat.locator(slot('aui_thread-viewport'))
    const atBottom = await viewport.evaluate(el => el.scrollTop)
    const vb = await viewport.boundingBox()
    await page.mouse.move(vb.x + vb.width / 2, vb.y + 200)
    await page.mouse.wheel(0, -700)
    await page.waitForFunction(before => document.querySelector('[data-slot="aui_thread-viewport"]').scrollTop < before - 100, atBottom)
    await chat.getByRole('button', { name: /^Scroll to bottom/ }).click()
    await page.waitForTimeout(400)
    const lastReply = chat.locator(slot('aui_assistant-message-content')).last()
    const replyBounds = await lastReply.boundingBox()
    const contextBounds = await chat.locator('.nocturne-context').boundingBox()
    assert.ok(replyBounds.y + replyBounds.height <= contextBounds.y, 'Last reply cannot hide beneath the context row')
    console.log('PASS scroll up, return to latest and composer clearance')
    await input.fill('Resize preserves this draft')
    const dock = chat.locator(slot('composer-dock'))
    const before = await dock.boundingBox()
    const handle = chat.locator('[data-composer-resize="right"]')
    const hb = await handle.boundingBox()
    await page.mouse.move(hb.x + 5, hb.y + hb.height / 2)
    await page.mouse.down()
    await page.mouse.move(hb.x - 45, hb.y + hb.height / 2, { steps: 8 })
    await page.mouse.up()
    assert.ok(Math.abs((await dock.boundingBox()).width - before.width + 100) < 2)
    assert.equal(await input.innerText(), 'Resize preserves this draft')
    const thread = await chat.locator(slot('aui_thread-content')).boundingBox()
    assert.ok(Math.abs(thread.width - ((await dock.boundingBox()).width - 10)) < 2, 'Transcript follows the resized composer')
    await chat.locator('[data-composer-resize="left"]').dblclick()
    await input.fill('')
    await page.screenshot({ path: join(dir, 'conversation.png') })
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(560, 760))
    await page.waitForTimeout(400)
    const narrow = await surface.boundingBox()
    assert.ok(narrow.x >= 0 && narrow.x + narrow.width <= await page.evaluate(() => innerWidth))
    const primary = await surface.locator('button.bg-foreground').boundingBox()
    assert.ok(primary.x >= narrow.x && primary.x + primary.width <= narrow.x + narrow.width, 'Primary action remains reachable')
    assert.ok(await viewport.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'No horizontal conversation overflow')
    await page.screenshot({ path: join(dir, 'narrow-conversation.png') })
    console.log('PASS shared-column resize, draft preservation and narrow layout')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 960))
    // The detached-composer boundary keeps native geometry.
    const composerRoot = chat.locator(slot('composer-root'))
    await composerRoot.evaluate(el => el.setAttribute('data-popped-out', ''))
    await page.waitForTimeout(250)
    assert.notEqual((await styleOf(input)).fontSize, '17px')
    await composerRoot.evaluate(el => el.removeAttribute('data-popped-out'))
    // Light mode uses the real persisted theme, not a manually toggled class.
    await page.evaluate(() => localStorage.setItem('hermes-desktop-mode-v1', 'light'))
    await page.reload()
    await bubble.waitFor({ state: 'visible', timeout: 45000 })
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark') && !!document.getElementById('nocturne-style'))
    await page.waitForTimeout(400)
    const lightBubble = await styleOf(bubble)
    assert.notEqual(lightBubble.background, 'rgb(43, 32, 45)')
    assert.equal((await styleOf(chat)).image, 'none')
    await page.screenshot({ path: join(dir, 'light-conversation.png') })
    await rm(join(home, 'desktop-plugins/nocturne'), { recursive: true })
    await page.waitForFunction(() => !document.getElementById('nocturne-style'))
    assert.equal((await styleOf(bubble)).background, lightBubble.background, 'Light appearance is unchanged by disabling Nocturne')
    assert.equal(await page.locator('.nocturne-context, .nocturne-title').count(), 0)
    console.log('PASS pop-out boundary, light mode and hot-uninstall cleanup')
  } catch (error) {
    const page = await app.firstWindow()
    await page.screenshot({ path: join(dir, 'failure.png') })
    console.log('Failure', error.message, dir, (await page.locator('body').innerText()).slice(-2500))
    throw error
  } finally {
    // Normal close first; both outcomes are handled so a late close failure
    // can never become an unhandled rejection, and a stuck quit is force-killed.
    const closed = app.close().then(() => 'closed', () => 'close-failed')
    await Promise.race([
      closed,
      new Promise(resolve => setTimeout(() => {
        try { app.process().kill('SIGKILL') } catch {}
        resolve('force-killed')
      }, 10000))
    ])
  }
})
