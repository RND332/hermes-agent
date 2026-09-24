import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('../../../', import.meta.url))

test('new-chat branding is hidden across reloads without hiding the composer; uninstall restores it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'clean-new-chat-'))
  const home = join(dir, 'home')
  const pluginDir = join(home, 'desktop-plugins/clean-new-chat')
  await mkdir(pluginDir, { recursive: true })
  await symlink(root, join(home, 'hermes-agent'))
  try {
    await copyFile(new URL('./plugin.js', import.meta.url), join(pluginDir, 'plugin.js'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const app = await electron.launch({
    executablePath: process.env.HERMES_TEST_APP || join(root, 'apps/desktop/release/linux-unpacked/Hermes'),
    args: [`--user-data-dir=${join(dir, 'userdata')}`, '--disable-setuid-sandbox', '--ozone-platform=headless', '--disable-gpu'],
    env: { ...process.env, HERMES_HOME: home, HERMES_DESKTOP_ISOLATED_BACKEND: '1' },
    timeout: 60000
  })
  try {
    const page = await app.firstWindow()
    const intro = page.locator('[data-slot="aui_intro"]').first()
    const input = page.locator('[contenteditable="true"]').first()
    await intro.waitFor({ state: 'attached', timeout: 45000 })
    assert.equal(await intro.isVisible(), false, 'New-chat branding should be hidden')
    await input.waitFor({ state: 'visible' })
    await page.getByRole('button', { name: "I'll choose a provider later", exact: true }).click({ timeout: 60000 })
    await page.waitForFunction(() => {
      const input = document.querySelector('[contenteditable="true"]')
      if (!input) return false
      const box = input.getBoundingClientRect()
      return input.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
    }, null, { timeout: 60000 }).catch(async error => {
      console.log((await page.locator('body').innerText()).slice(-3500))
      throw error
    })
    await input.fill('Unsent draft')
    assert.equal(await input.textContent(), 'Unsent draft')
    await page.screenshot({ path: join(dir, 'new-chat.png') })
    console.log(`Screenshot: ${join(dir, 'new-chat.png')}`)
    await page.reload()
    await intro.waitFor({ state: 'attached', timeout: 45000 })
    assert.equal(await intro.isVisible(), false, 'Branding should remain hidden after reload')
    assert.equal(await input.isVisible(), true)
    await rm(pluginDir, { recursive: true })
    await intro.waitFor({ state: 'visible', timeout: 15000 })
    assert.equal(await input.isVisible(), true)
  } finally {
    await app.close()
  }
})
