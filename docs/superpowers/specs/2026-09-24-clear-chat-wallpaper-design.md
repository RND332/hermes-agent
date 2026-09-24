# Clear new chats and make wallpapers easy to set

## Intent

Use [the reference screenshot](https://x.com/vishyfishy2/status/2092737810495127975) as a *composition* reference: an unobstructed, darkened wallpaper and a floating prompt composer. Keep Hermes's existing sidebar, header, status bar, transcript, and controls; do not imitate the reference app's chrome. Ordinary new chats must be clear with **or without** a wallpaper. Bot-specific empty chats retain their avatar/name.

## Fresh-chat layout

- Use the existing **Settings → Appearance → Intro Splash** switch, setting it **off in this installation**. Keep the switch and its default for other users; no replacement splash or guidance copy. The setting is independent of wallpaper enablement.
- In Hermes Desktop's chat surface, identify an ordinary fresh draft from the existing readiness, route, session, and message state (the same conditions that qualify the ordinary intro, independent of the Intro Splash setting). Place the *same mounted composer* around the lower-middle of that chat canvas. Keep it aligned to the chat column, not the full window, so the sidebar remains unchanged.
- On first submission/session creation, dock the same composer at the current bottom position. Preserve its focus, draft, attachment, queue, and scroll-measurement behavior; no editor remount. Existing sessions, bot chats, secondary/HUD windows, and manually popped-out composers retain their current placement. On narrow/short windows use the existing bottom dock rather than covering navigation or status UI. Respect reduced-motion preferences.
- No change to the wallpaper layering contract: only the chat reading canvas is translucent when wallpaper is on. Sidebar and reading panes (including previews, code, and approval surfaces) retain legible opaque fills.

## Wallpaper setup

Keep wallpaper in the installed standalone Desktop plugin, not in Hermes core. Publish its source in a separate **private** GitHub repository and keep the local installed copy synchronized. Keep the current sidebar **Wallpaper** entry.

- Lead with a large, accurate preview and the current selection/status, plus direct **Choose media**, **On/Off**, and **Remove** actions. Offer local recent selections and Wallpaper Engine items as clearly labeled thumbnail choices. A video selection gets a usable video preview instead of the current empty placeholder; avoid background video decoding when the app is hidden.
- Provide two visible looks for stills: **Reference** (halftone dots, restrained glow, vignette, and composer frost inspired by the screenshot) and **Original** (source pixel effects off). New still selections begin with Reference; saved selections and adjustments survive migration. Revisiting a recent item should not silently erase the current adjustments. Fit, dimming, and canvas clarity are directly accessible. Detailed dither/blur/glow/duotone/frost controls live in an expandable Advanced section. Selection and look changes preview in place without requiring a reload.
- Video plays as video, without pretending still-only image processing is available. Explain or disable those controls for video; preserve still-image choices when switching between media types. Keep basic fit/dim controls usable for both.
- Canceling a picker changes nothing. An unreadable/unsupported selection or failed Wallpaper Engine scan shows a specific error and retains the last working wallpaper and settings rather than persisting a broken selection. Loading, active, off, and empty states are distinguishable. Preserve existing per-installation storage and the working Wallpaper Engine discovery paths.

## Boundaries and verification

No new backend or service. The core change is confined to fresh-chat presentation; the plugin owns media, presets, and wallpaper settings. Verify with focused Desktop tests for fresh/first-message transitions and exemptions (splash off/on, wallpaper off/on, existing/bot/pop-out/HUD/narrow views), plus Desktop typecheck and production build. Verify plugin preset/storage/selection behavior with tests or a small harness and exercise the installed flow in an isolated renderer: image and video preview, error rollback, wallpaper on/off, sidebar/readability, and reference-like composition. Do not terminate the user's running app to obtain a debug port. Push the Hermes branch and private plugin repository; read back their remote heads before claiming delivery. Apply the new Desktop build to the user's window only after an explicit restart decision, preserving any unsent draft.
