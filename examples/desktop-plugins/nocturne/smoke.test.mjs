import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const slot = name => `[data-slot="${name}"]`

test('Paper new-chat composition preserves native editing and resizing', { timeout: 120000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nocturne-'))
  const home = join(dir, 'home')
  await mkdir(home, { recursive: true })
  await symlink(root, join(home, 'hermes-agent'))
  for (const id of ['composer-resize', 'clean-new-chat', 'plum-composer', 'nocturne']) {
    const dest = join(home, 'desktop-plugins', id)
    await mkdir(dest, { recursive: true })
    try { await copyFile(join(root, 'examples/desktop-plugins', id, 'plugin.js'), join(dest, 'plugin.js')) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  if (process.env.HERMES_TEST_WALLPAPER_PLUGIN) {
    await mkdir(join(home, 'desktop-plugins/hermes-wallpaper'), { recursive: true })
    await copyFile(process.env.HERMES_TEST_WALLPAPER_PLUGIN, join(home, 'desktop-plugins/hermes-wallpaper/plugin.js'))
  }
  const app = await electron.launch({
    executablePath: process.env.HERMES_TEST_APP || join(root, 'apps/desktop/release/linux-unpacked/Hermes'),
    args: [`--user-data-dir=${join(dir, 'userdata')}`, '--disable-setuid-sandbox', '--ozone-platform=headless', '--disable-gpu'],
    env: { ...process.env, HOME: dir, HERMES_REAL_HOME: dir, HERMES_HOME: home, HERMES_DESKTOP_ISOLATED_BACKEND: '1', HERMES_DESKTOP_SKIP_QUIT_CONFIRM: '1' }, timeout: 60000
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
    if (process.env.HERMES_TEST_WALLPAPER) await page.evaluate(path => {
      localStorage.setItem('hermes.plugin.hermes-wallpaper.settings', JSON.stringify({
        enabled: true, path, glass: 100, dim: 0, blur: 0, fit: 'cover',
        dither: { on: false }, fx: { vignette: 0, frost: 0, bloom: 0, posterize: 0, duotone: { on: false } }
      }))
    }, process.env.HERMES_TEST_WALLPAPER)
    await page.reload()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1))
    const input = page.locator(slot('composer-rich-input')).first()
    const surface = page.locator(slot('composer-surface')).first()
    const dock = page.locator(slot('composer-dock')).first()
    await input.waitFor({ state: 'visible', timeout: 45000 })
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    await page.waitForFunction(() => {
      const surface = document.querySelector('[data-slot="composer-surface"]')
      return surface && getComputedStyle(surface.querySelector('[aria-hidden]')).backgroundColor === 'rgb(36, 25, 35)'
    })
    await page.waitForTimeout(500)
    const measure = () => surface.evaluate(el => {
      const rect = el.getBoundingClientRect()
      const input = el.querySelector('[data-slot="composer-rich-input"]')
      return { height: rect.height, width: rect.width, top: rect.top, bottom: rect.bottom,
        viewport: innerHeight, radius: getComputedStyle(el).borderRadius,
        fill: getComputedStyle(el.querySelector('[aria-hidden]')).backgroundColor,
        inputTop: input.getBoundingClientRect().top, inputBottom: input.getBoundingClientRect().bottom,
        buttons: [...el.querySelectorAll('button')].map(b => ({ label: b.getAttribute('aria-label'), text: b.innerText, top: b.getBoundingClientRect().top })) }
    })
    const layout = await measure()
    console.log('Composition', JSON.stringify(layout), 'artifacts', dir)
    await page.screenshot({ path: join(dir, 'new-chat.png') })
    assert.ok(layout.height >= 160, 'The approved design needs an expanded two-row composer, not a recolored single line')
    assert.ok(layout.top > layout.viewport * .60 && layout.bottom < layout.viewport - 35, 'Composer must sit below the face with breathing room beneath')
    assert.equal(layout.fill, 'rgb(36, 25, 35)', 'Paper surface color')
    assert.equal(layout.radius, '16px')
    assert.ok(layout.buttons.some(b => b.top > layout.inputBottom), 'Native actions belong below the editor')
    assert.equal(await surface.locator('button.bg-foreground').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(216, 163, 192)', 'Primary action must match the Paper rose accent')
    await input.fill('First line\nSecond line')
    assert.match(await input.innerText(), /First line\s+Second line/)
    const beforeResize = await dock.boundingBox()
    const handle = page.locator('[data-composer-resize="right"]').first()
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-composer-resize="right"]'), r = el?.getBoundingClientRect()
      return r && document.elementFromPoint(r.x + 5, r.y + r.height / 2) === el
    })
    const box = await handle.boundingBox()
    await page.mouse.move(box.x + 5, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x - 55, box.y + box.height / 2, { steps: 8 })
    await page.mouse.up()
    assert.ok(Math.abs((await dock.boundingBox()).width - beforeResize.width + 120) < 2)
    assert.match(await input.innerText(), /First line\s+Second line/)
    await page.reload()
    await input.waitFor({ state: 'visible', timeout: 45000 })
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--hermes-composer-resize-width') !== '')
    assert.ok(Math.abs((await dock.boundingBox()).width - beforeResize.width + 120) < 2)
    await page.locator('[data-composer-resize="left"]').first().dblclick()
    await input.fill('')
    // Real native model and attachment menus remain reachable with pointer input.
    await page.getByRole('button', { name: 'Choose chat profile', exact: true }).click()
    await page.getByRole('menu').waitFor({ state: 'visible' })
    await page.keyboard.press('Escape')
    const model = page.locator('[data-tour="model-pill"]').first()
    await model.click()
    await page.locator('[data-slot="dropdown-menu-content"], [role="dialog"]').first().waitFor({ state: 'visible' })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Add context', exact: true }).click()
    await page.getByRole('menu').waitFor({ state: 'visible' })
    await page.keyboard.press('Escape')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(600, 760))
    await page.waitForTimeout(300)
    const narrow = await surface.boundingBox()
    assert.ok(narrow.x >= 0 && narrow.x + narrow.width <= await page.evaluate(() => innerWidth), 'Narrow windows cannot clip the composer')
    await page.screenshot({ path: join(dir, 'narrow.png') })
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.setSize(1440, 960)
      win.webContents.setZoomFactor(1)
    })
    const sidebarToggle = page.getByRole('button', { name: 'Hide sidebar', exact: true })
    if (await sidebarToggle.count()) await sidebarToggle.click()
    await page.waitForTimeout(500)
    if (process.env.HERMES_TEST_WALLPAPER) await page.waitForFunction(() => document.querySelector('#hw-layer img')?.naturalWidth > 0)
    await page.screenshot({ path: join(dir, 'new-chat.png') })
    // Pop-out stays native; a nonempty conversation switches to the compact composer.
    await page.locator(slot('composer-root')).first().evaluate(el => el.setAttribute('data-popped-out', ''))
    await page.waitForTimeout(250)
    assert.notEqual((await measure()).fill, layout.fill)
    await page.locator(slot('composer-root')).first().evaluate(el => el.removeAttribute('data-popped-out'))
    await page.locator('[data-chat-surface]').first().evaluate(el => el.removeAttribute('data-fresh-draft'))
    await page.waitForTimeout(250)
    assert.equal((await measure()).fill, layout.fill)
    assert.ok((await measure()).height < layout.height)
    await page.locator('[data-chat-surface]').first().evaluate(el => el.setAttribute('data-fresh-draft', ''))
    await page.evaluate(() => localStorage.setItem('hermes-desktop-mode-v1', 'light'))
    await page.reload()
    await input.waitFor({ state: 'visible', timeout: 45000 })
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark') && !!document.getElementById('nocturne-style'))
    await page.waitForTimeout(500)
    const light = await measure()
    await rm(join(home, 'desktop-plugins/nocturne'), { recursive: true })
    await page.waitForFunction(() => !document.getElementById('nocturne-style'))
    await page.waitForTimeout(250)
    assert.equal((await measure()).fill, light.fill, 'Light mode is not themed')
    assert.equal(await page.locator('.nocturne-context, .nocturne-title').count(), 0, 'Uninstall removes contributed controls')
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('hermes-nocturne')), false)
    console.log('PASS: composition, native editing, resize, persistence, model menu, narrow layout')
  } finally {
    // Same bounded teardown as conversation.test.mjs.
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
