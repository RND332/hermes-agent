# Wallpaper Setup UX Implementation Plan

> **For agentic workers:** Use executing-plans inline; sub-agents are disabled for this task. Track the steps below in order.

**Goal:** Make the existing Hermes Wallpaper plugin easy to set, preview and switch between Reference and Original looks.

**Architecture:** Keep the plugin standalone and uncompiled. Stage its source in a separate local Git repository, test and refactor its existing `WallpaperPage`, and deploy the verified file to `$HERMES_HOME/desktop-plugins/hermes-wallpaper/plugin.js`. Its `ctx.storage` contract and shell layering remain authoritative; Hermes core only owns the separate composer-layout change.

**Tech Stack:** Plain ESM (`@hermes/plugin-sdk`, React JSX runtime), Electron media bridge, Node test runner, isolated Desktop renderer.

**Spec:** `docs/superpowers/specs/2026-09-24-clear-chat-wallpaper-design.md`

## Global Constraints

- The Wallpaper sidebar row remains in place. Sidebar and reading surfaces remain opaque; only chat canvas can show wallpaper through it.
- New still selections use Reference by default; Original is a visible one-click choice. Existing saved selection and effects are not overwritten by the upgrade. Video effects are described honestly.
- Picker cancel and invalid/unsupported media leave the last good selection in place. Hidden windows do not keep preview videos decoding.
- A standalone `plugin.js` cannot import local helper modules or JSX syntax; only SDK, `react` and `react/jsx-runtime` imports are supported.
- The user chose a separate private GitHub repository for this plugin and a local installation. Do not edit or push this plugin into the Hermes fork.

---

### Task 1: Capture the working plugin as a reviewed source

**Files:** Create `~/Projects/hermes-wallpaper/plugin.js` from the currently installed plugin; create `~/Projects/hermes-wallpaper/README.md` documenting the single-file install and supported image/video/Wallpaper Engine behavior. Keep `~/.hermes/desktop-plugins/hermes-wallpaper/plugin.js` untouched until verification.

- [ ] Initialize a local git repository (private remote comes only after implementation). Copy the installed file verbatim; verify `node --check plugin.js` and record a baseline commit.
- [ ] Use direct `gh` binary (not the slow `~/.local/bin/gh` mise wrapper), confirm auth with `gh auth status`, then check for an existing `RND332/hermes-wallpaper` repository before creating a **private** one. Do not publish until the code is verified.

### Task 2: Presets and safe selection

**Files:** Modify `~/Projects/hermes-wallpaper/plugin.js`; add `~/Projects/hermes-wallpaper/test/settings.test.mjs` (pure VM module import with SDK stubs, or use an equivalent runnable harness against the actual exports).

**Interfaces:** `referenceLook(state)` and `originalLook(state)` return normalized patches; `selectCandidate(path, label, current)` validates the candidate before calling `commit` and updates recents only on success.

- [ ] Write RED tests that assert: existing persisted `dither`, `fx`, `glass`, `path` survive `normalize`; Reference turns on halftone with the agreed restrained glow/vignette/frost; Original turns source effects off while retaining fit/dim/glass; a newly chosen still takes Reference while revisiting Recent leaves adjustments intact; a failed candidate never calls `commit`.
- [ ] Run the test suite and observe the intentional failure.
- [ ] Implement preset patch helpers near `DEFAULTS`. Keep existing persisted settings authoritative. For local/Engine new stills, apply the Reference patch in the successful candidate commit; for Recent, retain the current adjustments. For videos keep still presets saved but do not claim they process video.
- [ ] Validate stills through the existing file bridge and image decoder before committing; validate video through `hermes-media://stream/` metadata/error events with a bounded timeout, cleaning up the probe element. Show a concrete error on failure without replacing the current path, preview, or persisted settings.
- [ ] Run tests GREEN and `node --check plugin.js`; commit the preset/selection behavior.

### Task 3: Selection-first Wallpaper page

**Files:** Modify `~/Projects/hermes-wallpaper/plugin.js`; extend tests or renderer smoke harness.

- [ ] Add a failing renderer probe for visible current preview, source actions, Reference/Original buttons, collapsed Advanced details and video-specific states; current page has a blank video placeholder and flat controls, so observe RED.
- [ ] Refactor `WallpaperPage` into small same-file view helpers: top selected-media hero with a large still preview or an on-demand `<video controls muted playsInline preload="metadata">`; grouped file picker/Wallpaper Engine/recent thumbnail choices; visible two-look control and fit/dim/glass; `<details>` for advanced image effects. Retain the existing `ROUTES_AREA` and `SIDEBAR_NAV_AREA` registration. Use theme variables and accessible button labels, and show active/off/loading/error states. Recent thumbnails may load lazily; do not read video files as data URLs.
- [ ] Hide or disable still-only controls on video with explanatory text. Ensure `useWe` and local/Recent selection paths all use Task 2's safe-selection behavior. Keep scan errors visible and preserve the current gallery if scanning fails.
- [ ] Run node syntax and behavioral tests, then an isolated renderer smoke showing image preview, on-demand video preview, preset switch, invalid selection rollback, Wallpaper Engine gallery and sidebar. Commit the page UX.

### Task 4: Ship without clobbering the live window

**Files:** Deploy `plugin.js` from the private repository to the installed plugin path after the isolated smoke. Check the file's content hash on both ends before copying; do not overwrite a concurrently modified installed file.

- [ ] Run `gh repo view RND332/hermes-wallpaper --json visibility,nameWithOwner` or create it private if absent (`gh repo create RND332/hermes-wallpaper --private --source . --remote origin`); push the tested commits and verify via a fresh remote read that visibility is PRIVATE and remote HEAD matches local HEAD.
- [ ] Copy the verified plugin to `~/.hermes/desktop-plugins/hermes-wallpaper/plugin.js`; the Desktop plugin watcher hot-reloads it. Verify its state on the exact target: installed content hash matches, app plugin is enabled, existing wallpaper setting is retained, and the new Wallpaper page actually opens. Do not navigate the user's window or replace their draft solely to verify; use an isolated app when in doubt.
- [ ] Record any blocked verification plainly. Do not claim the running packaged Hermes core has updated until that app is rebuilt and safely restarted.
