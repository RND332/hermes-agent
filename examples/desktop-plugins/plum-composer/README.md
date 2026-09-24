# Plum composer

Standalone Hermes Desktop appearance plugin: a roomier dark composer with an opaque plum tint, a subtle border and a clearer focused border. Colors derive from the active theme's semantic palette.

Only the docked dark composer is styled. Light mode, native HUD/pop-out, drag/drop feedback, controls and the separate `composer-resize` plugin retain their behavior. There are no observers, settings or core-app changes. Disabling the plugin removes its stylesheet.

## Install

```sh
mkdir -p "${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/plum-composer"
cp examples/desktop-plugins/plum-composer/plugin.js "${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/plum-composer/plugin.js"
```

Hermes discovers the plugin automatically. If necessary, use **Reload desktop plugins** in the command palette. Disable **Plum composer** in the plugin settings to revert.

## Verify

From the repository root, with workspace dependencies and a packaged desktop build:

```sh
node --test examples/desktop-plugins/plum-composer/smoke.test.mjs
```

`HERMES_TEST_APP` overrides the executable path. The test uses an independent Electron user-data directory and temporary Hermes home; it checks actual computed appearance, draft editing, mouse resizing, persistence, light/pop-out exclusions and uninstall cleanup. It sends no prompts.
