import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'

let browser, server, url
const fixture = `<!doctype html><style>
  * {box-sizing:border-box} body {margin:0; --composer-width:100%; --ui-accent:purple}
  [data-chat-surface] {position:relative; width:100%; height:600px}
  [data-slot="aui_thread-content"] {width:100%; max-width:var(--composer-width)}
  [data-slot="composer-dock"] {position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:calc(min(var(--composer-width), calc(100% - 2rem)) + 10px)}
  [data-slot="composer-dock"][data-popped-out] {width:384px}
  [data-slot="composer-root"] {position:relative; padding:0 5px}
  textarea {width:100%; height:100px}
</style><div data-chat-surface><div data-slot="aui_thread-content">Transcript</div>
<div data-slot="composer-dock"><form data-slot="composer-root"><textarea>Unsent draft</textarea></form></div></div>
<script type="module">
  const response = await fetch('/plugin.js');
  if (response.ok) {
    const plugin = (await import('/plugin.js')).default;
    window.dispose = () => {};
    plugin.register({onDispose: fn => { window.dispose = fn }, storage:{
      get: key => JSON.parse(localStorage.getItem(key) ?? 'null'),
      set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
      remove: key => localStorage.removeItem(key)
    }});
  }
  window.ready = true;
</script>`

before(async () => {
  server = createServer(async (req, res) => {
    if (req.url === '/plugin.js') {
      try {
        res.setHeader('Content-Type', 'text/javascript')
        res.end(await readFile(new URL('./plugin.js', import.meta.url)))
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        res.writeHead(404).end()
      }
    } else res.end(fixture)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', headless: true })
})
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)) })

const dock = '[data-slot="composer-dock"]'
const handle = side => `[data-composer-resize="${side}"]`
async function open() {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  await page.goto(url)
  await page.waitForFunction(() => window.ready)
  return page
}
async function drag(page, side, dx) {
  const box = await page.locator(handle(side)).boundingBox()
  assert.ok(box, `${side} resize handle must be visible`)
  const x = box.x + box.width / 2, y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 8 })
  await page.mouse.up()
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 2, `${a} should equal ${b}`)

test('dragging the right edge shrinks around the center without resizing the transcript or losing the draft', async () => {
  const page = await open()
  try {
    const before = await page.locator(dock).boundingBox()
    const thread = await page.locator('[data-slot="aui_thread-content"]').boundingBox()
    await drag(page, 'right', -120)
    const after = await page.locator(dock).boundingBox()
    near(after.width, before.width - 240)
    near(after.x + after.width / 2, before.x + before.width / 2)
    assert.deepEqual(await page.locator('[data-slot="aui_thread-content"]').boundingBox(), thread)
    assert.equal(await page.locator('textarea').inputValue(), 'Unsent draft')
  } finally { await page.close() }
})

test('disable removes handles and restores the original width', async () => {
  const page = await open()
  try {
    const initial = await page.locator(dock).boundingBox()
    await drag(page, 'left', 100)
    await page.evaluate(() => window.dispose())
    assert.equal(await page.locator('[data-composer-resize]').count(), 0)
    near((await page.locator(dock).boundingBox()).width, initial.width)
  } finally { await page.close() }
})

test('left-edge resizing persists after reload and double-click resets it', async () => {
  const page = await open()
  try {
    const initial = await page.locator(dock).boundingBox()
    await drag(page, 'left', 100)
    const resized = await page.locator(dock).boundingBox()
    near(resized.width, initial.width - 200)
    await page.reload(); await page.waitForFunction(() => window.ready)
    near((await page.locator(dock).boundingBox()).width, resized.width)
    await page.locator(handle('left')).dblclick()
    near((await page.locator(dock).boundingBox()).width, initial.width)
    await page.reload(); await page.waitForFunction(() => window.ready)
    near((await page.locator(dock).boundingBox()).width, initial.width)
  } finally { await page.close() }
})

test('narrow panes clamp without losing the preferred width or overflowing', async () => {
  const page = await open()
  try {
    await drag(page, 'right', -200)
    const preferred = (await page.locator(dock).boundingBox()).width
    await page.setViewportSize({ width: 300, height: 800 })
    const narrow = await page.locator(dock).boundingBox()
    assert.ok(narrow.x >= 0 && narrow.x + narrow.width <= 300)
    await page.setViewportSize({ width: 1200, height: 800 })
    near((await page.locator(dock).boundingBox()).width, preferred)
    await drag(page, 'right', -1000)
    assert.ok((await page.locator(dock).boundingBox()).width >= 320)
    await drag(page, 'right', 1400)
    assert.ok((await page.locator(dock).boundingBox()).width <= 1200)
  } finally { await page.close() }
})

test('a size saved in a tiny pane remains usable when the pane grows', async () => {
  const page = await open()
  try {
    await page.setViewportSize({ width: 280, height: 800 })
    await drag(page, 'right', -50)
    await page.setViewportSize({ width: 1200, height: 800 })
    assert.ok((await page.locator(dock).boundingBox()).width >= 320)
  } finally { await page.close() }
})

test('cancelled drag restores the prior width and leaves no global drag state', async () => {
  const page = await open()
  try {
    const initial = await page.locator(dock).boundingBox()
    const box = await page.locator(handle('right')).boundingBox()
    await page.mouse.move(box.x + 5, box.y + 10); await page.mouse.down()
    await page.mouse.move(box.x - 100, box.y + 10)
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await page.mouse.up()
    near((await page.locator(dock).boundingBox()).width, initial.width)
    assert.equal(await page.locator('html[data-composer-resizing]').count(), 0)
  } finally { await page.close() }
})

test('new composers get one pair of handles and popped-out composers keep their existing size', async () => {
  const page = await open()
  try {
    await drag(page, 'right', -100)
    await page.evaluate(() => {
      const surface = document.querySelector('[data-chat-surface]')
      const extra = document.createElement('div')
      extra.dataset.slot = 'composer-dock'
      extra.setAttribute('data-popped-out', '')
      extra.innerHTML = '<form data-slot="composer-root"><textarea>Other draft</textarea></form>'
      surface.append(extra)
    })
    await page.waitForFunction(() => document.querySelectorAll('[data-composer-resize]').length === 4)
    near((await page.locator(`${dock}[data-popped-out]`).boundingBox()).width, 384)
    assert.equal(await page.locator(`${dock}[data-popped-out] ${handle('right')}`).isVisible(), false)
    await page.locator(`${dock}[data-popped-out]`).evaluate(el => el.removeAttribute('data-popped-out'))
    near((await page.locator(dock).nth(1).boundingBox()).width, (await page.locator(dock).nth(0).boundingBox()).width)
    await page.locator(dock).nth(1).evaluate(el => el.remove())
    assert.equal(await page.locator('[data-composer-resize]').count(), 2)
  } finally { await page.close() }
})
