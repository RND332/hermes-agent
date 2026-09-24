# Clean new chat

Hides the new-chat wordmark and tagline with one scoped CSS rule. Does not change the composer, transcript, wallpaper, or other app branding. No core changes or rebuild required.

Install `plugin.js` at `$HERMES_HOME/desktop-plugins/clean-new-chat/plugin.js` (default home: `~/.hermes`). Desktop hot-reloads it automatically. Disable **Clean new chat** in Plugins to restore the intro.

Packaged Electron smoke test (run from the repository root after packaging Desktop):

```sh
node --test examples/desktop-plugins/clean-new-chat/smoke.test.mjs
```

Set `HERMES_TEST_APP` to use another packaged executable. The test launches a headless, isolated home/user-data directory, skips provider setup without sending messages, and checks hiding, composer input, reload persistence, and uninstall cleanup.
