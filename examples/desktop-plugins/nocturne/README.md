# Nocturne — Paper new chat

Implementation of the approved [Paper artboard](https://app.paper.design/file/01M39Y6YEZK05Z9Z016ZB3DE9W/p-1-0), `01 · New chat — Nocturne`.

Standalone, hot-reloaded desktop plugin; no core patch or application restart. Copy `plugin.js` into `$HERMES_HOME/desktop-plugins/nocturne/plugin.js`. Disable **Nocturne — Paper new chat** in Desktop Plugins to restore the previous appearance.

## Design and scope

- Dark-mode palette is explicitly scoped to this appearance plugin, without changing the selected skin or light theme.
- Fresh chat: illustration-first canvas, local bottom fade, 912px default composer, 16px corners, two rows, command hints, rose primary action.
- The existing wallpaper plugin owns the image and its persistence. No image is bundled or uploaded by this plugin. Preprocessed art should have the wallpaper plugin's extra dither/blur/dim disabled.
- Native editor, attachments, model/effort controls, dictation, voice engine, submit, stop, status stack and drag handles remain native. Existing saved resize width wins over the default.
- The live app deliberately retains model-specific effort and voice-engine controls rather than replacing them with static mockup labels. Smart approval mode stays in the native status bar; this visual plugin never changes safety settings.
- Main fresh draft context uses the current profile and actual working directory. Profile choices use SDK routes; project actions open the existing Files pane. No fabricated project label when no folder is attached.
- Existing conversation geometry and popped-out/HUD input are excluded. Titlebar New chat buttons start real drafts via the SDK, not fake tabs. Native session tabs and system actions remain available.
- Plugin contributions and stylesheet are removed on disable/uninstall.

## Verification

```sh
node --check examples/desktop-plugins/nocturne/plugin.js
node --test examples/desktop-plugins/nocturne/smoke.test.mjs
```

Requires the packaged Desktop build and Playwright. Uses a separate Electron user-data directory and temporary plugin home. Does not submit prompts, change approval mode or select another profile. Tests editor geometry, native menu opening, draft-preserving resize, saved width, narrow windows, dark-only scope and disposal. The pop-out and normal-chat CSS gates are exercised by toggling their DOM markers; no native pop-out window is opened.

Optional real-wallpaper integration (paths are test inputs, not installed defaults):

```sh
HERMES_TEST_WALLPAPER_PLUGIN=/path/to/hermes-wallpaper/plugin.js \
HERMES_TEST_WALLPAPER=/path/to/preprocessed-art.png \
node --test examples/desktop-plugins/nocturne/smoke.test.mjs
```

The runner prints the temporary artifact directory containing `new-chat.png` and `narrow.png`. Desktop-managed zoom may change CSS viewport dimensions; geometry is measured in the renderer's own coordinates.
