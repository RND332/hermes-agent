# Nocturne — Paper chat

Implementation of the approved [Paper artboards](https://app.paper.design/file/01M39Y6YEZK05Z9Z016ZB3DE9W/p-1-0): `01 · New chat — Nocturne` and `02 · Conversation — Nocturne`.

Standalone, hot-reloaded desktop plugin; no core patch or application restart. Copy `plugin.js` into `$HERMES_HOME/desktop-plugins/nocturne/plugin.js`. Disable **Nocturne — Paper chat** in Desktop Plugins to restore the previous appearance.

## Design and scope

- Dark-mode palette is explicitly scoped to this appearance plugin, without changing the selected skin or light theme.
- Fresh chat: illustration-first canvas, local bottom fade, 912px default composer, 16px corners, two rows, command hints, rose primary action.
- The existing wallpaper plugin owns the image and its persistence. No image is bundled or uploaded by this plugin. Preprocessed art should have the wallpaper plugin's extra dither/blur/dim disabled.
- Native editor, attachments, model/effort controls, dictation, voice engine, submit, stop, status stack and drag handles remain native. Existing saved resize width wins over the default.
- The live app deliberately retains model-specific effort and voice-engine controls rather than replacing them with static mockup labels. Smart approval mode stays in the native status bar; this visual plugin never changes safety settings.
- Main-chat context uses the current profile and actual working directory. Profile choices use SDK routes; project actions open the existing Files pane. No fabricated project label when no folder is attached.
- Conversations use an 832px default shared reading column, a pane-local scrim, plum user bubbles, open assistant text, compact tool disclosures and a 120px composer. Saved column width still wins; popped-out/HUD input geometry is excluded. Titlebar New chat buttons start real drafts via the SDK, not fake tabs. Native session tabs and system actions remain available.
- Plugin contributions and stylesheet are removed on disable/uninstall.

## Verification

```sh
node --check examples/desktop-plugins/nocturne/plugin.js
node --test --test-concurrency=1 examples/desktop-plugins/nocturne/*.test.mjs
```

Requires the packaged Desktop build, Playwright and the repository Python environment. The two integration tests use separate HOME, HERMES_REAL_HOME, HERMES_HOME and Electron user data. Run sequentially to avoid intermittent parallel Electron startup hangs. Conversation messages are explicitly synthetic and seeded into an isolated SessionDB. Neither test submits prompts, changes approval mode or selects another profile. Coverage: editor geometry, native model/attachment menus, nested tool expansion/collapse, wheel scrolling and return-to-latest clearance, draft-preserving shared-column resize, saved width, narrow windows, persisted light mode and hot-uninstall cleanup. The detached-composer CSS boundary is tested by toggling its DOM marker, not by opening a native pop-out window.

Optional real-wallpaper integration (paths are test inputs, not installed defaults):

```sh
HERMES_TEST_WALLPAPER_PLUGIN=/path/to/hermes-wallpaper/plugin.js \
HERMES_TEST_WALLPAPER=/path/to/preprocessed-art.png \
node --test --test-concurrency=1 examples/desktop-plugins/nocturne/*.test.mjs
```

The runner prints the temporary artifact directory containing new-chat, conversation, expanded-tool, narrow and light-mode screenshots. Desktop-managed zoom may change CSS viewport dimensions; geometry is measured in the renderer's own coordinates.
