import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const slot = name => `[data-slot="${name}"]`

test('composer styling preserves editing, resizing, reload and native light/pop-out surfaces', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plum-composer-'))
  const home = join(dir, 'home')
  const pluginDir = join(home, 'desktop-plugins/plum-composer')
  await mkdir(home, { recursive: true })
  await symlink(root, join(home, 'hermes-agent'))
  for (const id of ['composer-resize', 'clean-new-chat']) {
    await mkdir(join(home, 'desktop-plugins', id), { recursive: true })
    await copyFile(join(root, 'examples/desktop-plugins', id, 'plugin.js'), join(home, 'desktop-plugins', id, 'plugin.js'))
  }
  const app = await electron.launch({
    executablePath: process.env.HERMES_TEST_APP || join(root, 'apps/desktop/release/linux-unpacked/Hermes'),
    args: [`--user-data-dir=${join(dir, 'userdata')}`, '--disable-setuid-sandbox', '--ozone-platform=headless', '--disable-gpu'],
    env: { ...process.env, HERMES_HOME: home, HERMES_DESKTOP_ISOLATED_BACKEND: '1' },
    timeout: 60000
  })
  try {
    const page = await app.firstWindow()
    page.setDefaultTimeout(15000)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 960))
    await page.getByRole('button', { name: "I'll choose a provider later", exact: true }).click({ timeout: 60000 })
    await page.evaluate(() => {
      localStorage.setItem('hermes-desktop-mode-v1', 'dark')
      localStorage.setItem('hermes-desktop-theme-v2', 'mono')
    })
    await page.reload()
    const input = page.locator(slot('composer-rich-input')).first()
    const surface = page.locator(slot('composer-surface')).first()
    const dock = page.locator(slot('composer-dock')).first()
    await input.waitFor({ state: 'visible', timeout: 45000 })
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    await input.fill('Unsent draft')
    const measure = () => surface.evaluate(el => {
      const css = getComputedStyle(el)
      const backing = el.querySelector('[aria-hidden]')
      return { height: el.getBoundingClientRect().height, border: css.borderColor,
        fill: getComputedStyle(backing).backgroundColor, radius: css.borderRadius }
    })
    const before = await measure()
    console.log('Native composer:', before)
    await mkdir(pluginDir, { recursive: true })
    try {
      await copyFile(new URL('./plugin.js', import.meta.url), join(pluginDir, 'plugin.js'))
    } catch (error) { if (error.code !== 'ENOENT') throw error }
    await page.waitForFunction(() => !!document.getElementById('plum-composer-style'), null, { timeout: 15000 })
    await page.waitForTimeout(250)
    const styled = await measure()
    console.log('Styled composer:', styled)
    assert.ok(styled.height > before.height, 'Styled composer should give the input more vertical breathing room')
    assert.notEqual(styled.fill, before.fill, 'The actual backing layer should receive the plum tint')
    assert.notEqual(styled.border, before.border, 'The surface should receive the new border')
    assert.equal(await input.textContent(), 'Unsent draft', 'Hot-loading must preserve the unsent draft')
    await input.fill('First line\nSecond line')
    assert.match(await input.innerText(), /First line\s+Second line/)
    await input.fill('')
    await page.waitForFunction(() => {
      const h = document.querySelector('[data-composer-resize="right"]')
      const r = h?.getBoundingClientRect()
      return r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === h
    }, null, { timeout: 15000 })
    const initial = await dock.boundingBox()
    const handle = await page.locator('[data-composer-resize="right"]').first().boundingBox()
    await page.mouse.move(handle.x + 5, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x - 55, handle.y + handle.height / 2, { steps: 8 })
    await page.mouse.up()
    const resized = await dock.boundingBox()
    assert.ok(Math.abs(initial.width - resized.width - 120) < 2, 'Existing resize gesture must still work')
    await page.reload()
    await surface.waitFor({ state: 'visible', timeout: 45000 })
    await page.waitForFunction(() => !!document.getElementById('plum-composer-style'))
    await page.waitForTimeout(250)
    assert.equal((await measure()).fill, styled.fill, 'Tint persists across reload')
    assert.ok(Math.abs((await dock.boundingBox()).width - resized.width) < 2, 'Saved width persists')
    await page.locator('[data-composer-resize="left"]').first().dblclick()
    assert.ok(Math.abs((await dock.boundingBox()).width - initial.width) < 2)
    await page.locator(slot('composer-root')).first().evaluate(el => el.setAttribute('data-popped-out', ''))
    await page.waitForTimeout(250)
    assert.equal((await measure()).fill, before.fill, 'Pop-out keeps the native fill')
    await page.locator(slot('composer-root')).first().evaluate(el => el.removeAttribute('data-popped-out'))
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    await page.waitForTimeout(250)
    const lightStyled = await measure()
    await rm(pluginDir, { recursive: true })
    await page.waitForTimeout(2000)
    assert.deepEqual(await measure(), lightStyled, 'Light appearance is unaffected by the plugin')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(250)
    assert.equal((await measure()).fill, before.fill, 'Uninstall restores the native fill')
    // Reinstall for a screenshot of the real packaged app, not a mock composer.
    await mkdir(pluginDir, { recursive: true })
    await copyFile(new URL('./plugin.js', import.meta.url), join(pluginDir, 'plugin.js'))
    await page.waitForTimeout(2000)
    await page.screenshot({ path: join(dir, 'composer.png') })
    console.log(JSON.stringify({ before, styled, screenshot: join(dir, 'composer.png'), probeHome: home }))
  } finally { await app.close() }
})
