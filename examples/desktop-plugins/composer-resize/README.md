# Resizable composer (standalone desktop plugin)

Drag either side edge of the input to change its width. The composer stays centered;
its preferred width is remembered across reloads. Double-click an edge to restore
normal width. Keyboard: focus an edge, use Left/Right to resize, Home to reset.

Only the composer dock changes width. The transcript and unsent draft are untouched.
Small panes clamp to the available space; popped-out composers retain their existing
floating size and drag behavior. No settings page or Hermes core changes.

## Install

Copy `plugin.js` to `$HERMES_HOME/desktop-plugins/composer-resize/plugin.js`
(`$HERMES_HOME` defaults to `~/.hermes`). The desktop plugin watcher loads it live.
Disable **Resizable composer** in Capabilities → Plugins to restore the original UI.
The saved preference uses the plugin SDK's window-local, namespaced storage.

## Verify

From the repository root, with its development dependencies installed:

```sh
CHROME_PATH=/path/to/chrome node --test examples/desktop-plugins/composer-resize/browser.test.mjs
```

`CHROME_PATH` defaults to `/opt/google/chrome/chrome` on this Linux setup. These are
real Chromium pointer tests against a small composer-layout fixture, not the whole
application. They exercise drag geometry, draft/transcript preservation, persistence,
reset, narrow panes, cancelled drags, pop-out exclusion, dynamic mounts, and cleanup.
Also smoke-tested against the packaged Hermes Desktop renderer using an independent
Electron user-data directory: native mouse drag, centered geometry, reload and reset.

The plugin relies on Hermes's `composer-root` / `composer-dock` data-slot hooks and
the existing 5px grab margin. Recheck the packaged UI if those hooks change.
