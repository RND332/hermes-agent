# Clear Fresh-Chat Composer Implementation Plan

> **For agentic workers:** Use executing-plans inline; sub-agents are disabled for this task. Track the steps below in order.

**Goal:** Clear ordinary fresh chats and float their composer over the chat canvas until the first message.

**Architecture:** Keep the existing Intro Splash preference as the content switch; turn it off on this installation, not globally. Expose a pure fresh-draft predicate independent of the preference and attach one state attribute to the chat surface. CSS moves the existing mounted composer dock only in that state. No editor reparenting, sidebar changes, or backend changes.

**Tech Stack:** React/TypeScript, Tailwind/CSS, Vitest, Electron.

**Spec:** `docs/superpowers/specs/2026-09-24-clear-chat-wallpaper-design.md`

## Global Constraints

- Ordinary new chats are blank with or without wallpaper; bot-specific empty chats retain their avatar/name.
- Existing sidebar, header, status bar, transcript, HUD/secondary windows and manually popped-out composers retain their behavior.
- Narrow/short windows dock normally; reduced motion is respected. Preserve drafts, focus, attachments, queues and composer measurements.
- The user declined a worktree: use the current `feat/clear-wallpaper-chat` branch, which is already pushed to `fork`.

---

### Task 1: Predicate and on/off intro independence

**Files:** Modify `apps/desktop/src/app/chat/intro-visibility.ts` and `intro-visibility.test.ts`.

**Interfaces:** `isFreshPrimaryDraft(input: Omit<IntroInput, 'enabled'>): boolean` identifies layout eligibility. `shouldShowIntro(input: IntroInput): boolean` remains the user-preference-gated content predicate.

- [ ] Add a failing test: `isFreshPrimaryDraft({ ...showing, enabled: false })` is true after stripping `enabled`, while each existing session/auxiliary/tile/unready/nonempty case is false. Keep the `shouldShowIntro(enabled:false)` assertion.
- [ ] Run `npx vitest run --project ui src/app/chat/intro-visibility.test.ts` from `apps/desktop` and observe RED for the absent export.
- [ ] Extract the existing predicate body to `isFreshPrimaryDraft`; implement `shouldShowIntro` as `input.enabled && isFreshPrimaryDraft(input)` (a structural type accepts the extra property). Keep a single definition of the draft conditions.
- [ ] Re-run the focused test; commit as part of Task 2 when the layout behavior is observable.

### Task 2: Position the same composer, not a second composer

**Files:** Modify `apps/desktop/src/app/chat/index.tsx` and `apps/desktop/src/styles.css`; add a focused CSS/layout behavior test under `apps/desktop/src/app/chat/` using the existing Vitest UI project or a browser-level DOM assertion if styles are not applied in jsdom.

**Interfaces:** `[data-chat-surface][data-fresh-draft]` means Task 1's predicate is true. The CSS targets `[data-slot='composer-dock']:not([data-popped-out])` under that surface.

- [ ] Add the behavior probe first: for a fresh primary draft with Intro Splash off, assert `data-fresh-draft` and a single composer; after the first message/session id appears, assert the attribute disappears and the same editor instance remains. For short or narrow canvases, assert the dock stays bottom in a browser layout probe.
- [ ] Run the focused test/probe and observe RED.
- [ ] Compute the predicate once in `ChatView`, set `data-fresh-draft={freshDraft ? '' : undefined}` on its existing root, and reuse it for the intro toggle (`showIntro = introSplash && freshDraft`). Remove unused intro logic imports.
- [ ] Add one CSS rule beside the existing composer-dock rule to place the dock at about 30% above the chat canvas bottom only when `data-fresh-draft` is present and the window/column is sufficiently tall and wide. Leave the existing `bottom-0` class authoritative otherwise; do not override `[data-popped-out]`. Use a small position transition guarded by `prefers-reduced-motion: no-preference`; verify CSS specificity against the Tailwind utility.
- [ ] Re-run the focused test and browser probe GREEN; run `npm run typecheck` and `npm run build` from `apps/desktop`. Commit the core change and push `fork/feat/clear-wallpaper-chat`.

### Task 3: Apply the preference and validate the installed flow

**Files:** No core source needed for the switch; existing `apps/desktop/src/store/intro-splash.ts` stores `hermes.desktop.intro-splash.v1`.

- [ ] With an explicit safe app interaction, set **Settings → Appearance → Intro Splash** off for this installation; read the setting back without inspecting unrelated localStorage keys. Do not kill the user's current app for CDP access.
- [ ] Launch an isolated dev or packaged renderer on a separate data directory and CDP port, verifying empty chat with wallpaper off/on, lower-center composer, normal bottom dock after sending, intact sidebar, and the bot/pop-out exceptions. Exercise a short/narrow viewport and reduced-motion.
- [ ] Leave the running app intact until a safe restart decision; the built source does not retroactively replace its loaded bundle. Report precisely which view was verified and which one needs restart.
