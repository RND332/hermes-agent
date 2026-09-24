import { jsx, jsxs } from 'react/jsx-runtime'
import { useState } from 'react'
import { host, useValue, Codicon, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@hermes/plugin-sdk'

// Approved Paper artboard: 01M39Y6YEZK05Z9Z016ZB3DE9W / 1-0.
// An explicit, opt-in visual palette, scoped to dark mode; never changes the selected skin.
const fresh = 'html.dark.hermes-nocturne [data-chat-surface][data-fresh-draft]'
const root = `${fresh} [data-slot="composer-root"]:not([data-popped-out]):not(.hud-native-drag)`
const glyph = name => jsx(Codicon, { name, size: '16px' })
const button = (props, children) => jsxs('button', { type: 'button', ...props, children })

function ContextRow() {
  const profile = useValue(host.state.profile)
  const cwd = useValue(host.state.cwd)
  const [routes, setRoutes] = useState([])
  const [error, setError] = useState('')
  const load = open => {
    if (open) void host.profileRoutes().then(setRoutes).catch(() => setError('Profiles unavailable'))
  }
  return jsxs('div', { className: 'nocturne-context', children: [
    jsx(DropdownMenu, { onOpenChange: load, children: [
      jsx(DropdownMenuTrigger, { asChild: true, children: button({ 'aria-label': 'Choose chat profile' }, [glyph('account'), jsx('span', { children: profile || 'default' }), glyph('chevron-down')]) }),
      jsxs(DropdownMenuContent, { align: 'start', side: 'top', children: [
        ...routes.map(route => jsx(DropdownMenuItem, { onSelect: () => host.newChat(route), children: route.profile }, `${route.connectionId}:${route.profile}`)),
        !routes.length && jsx(DropdownMenuItem, { disabled: true, children: error || 'Loading profiles…' })
      ] })
    ] }),
    cwd && jsx('span', { className: 'nocturne-divider', 'aria-hidden': true }),
    cwd && jsx(DropdownMenu, { children: [
      jsx(DropdownMenuTrigger, { asChild: true, children: button({ 'aria-label': 'Project actions', title: cwd }, [glyph('folder'), jsx('span', { className: 'nocturne-project-name', children: cwd.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || cwd }), glyph('chevron-down')]) }),
      jsx(DropdownMenuContent, { align: 'start', side: 'top', children: jsx(DropdownMenuItem, { onSelect: () => host.revealPane('files'), children: 'Open project files' }) })
    ] })
  ] })
}

function Title() {
  return jsxs('div', { className: 'nocturne-title', children: [
    jsx('span', { className: 'nocturne-wordmark', children: 'Hermes' }),
    button({ className: 'nocturne-new-chat', onClick: () => host.newChat(), 'aria-label': 'Start a new chat' }, [glyph('edit'), jsx('span', { children: 'New chat' })]),
    button({ className: 'nocturne-new-button', onClick: () => host.newChat(), 'aria-label': 'New chat' }, [glyph('add')])
  ] })
}

export default {
  id: 'nocturne',
  name: 'Nocturne — Paper new chat',
  description: 'Illustration-first new chat, expanded composer and quiet chrome. Keeps the native editor, controls and resize gestures.',
  register(ctx) {
    const html = document.documentElement
    const style = document.createElement('style')
    style.id = 'nocturne-style'
    style.textContent = `
      html.dark.hermes-nocturne {
        --nocturne-ink: #0B090D;
        --nocturne-surface: #241923;
        --nocturne-border: #594252;
        --nocturne-accent: #D8A3C0;
        --nocturne-text: #F4ECF2;
        --nocturne-muted: #AC9BA8;
        --composer-width: 912px;
      }
      .nocturne-title, .nocturne-context, .nocturne-settings { display: none; }
      html.dark.hermes-nocturne [data-titlebar-cluster] { color: var(--nocturne-muted); }
      html.dark.hermes-nocturne .nocturne-title { display: flex; align-items: center; gap: 20px; margin-left: 14px; font-size: 14px; -webkit-app-region: no-drag; }
      .nocturne-wordmark { color: var(--nocturne-text); font-weight: 500; padding-right: 20px; border-right: 1px solid var(--nocturne-border); }
      .nocturne-title button { display: flex; align-items: center; gap: 10px; cursor: pointer; color: var(--nocturne-text); }
      .nocturne-title .nocturne-new-chat { width: 180px; height: 36px; padding: 0 14px; border-radius: 9px; background: var(--nocturne-surface); border: 1px solid var(--nocturne-border); }
      .nocturne-new-button { width: 28px; height: 32px; justify-content: center; }
      html.dark.hermes-nocturne [data-slot="statusbar"] { background: var(--nocturne-ink); color: var(--nocturne-muted); }
      html.dark.hermes-nocturne.hermes-wallpaper #hw-layer { inset: 52px 8px 28px; border-radius: 14px; background: var(--nocturne-ink); }
      html.dark.hermes-nocturne.hermes-wallpaper #hw-layer::after {
        content: ''; position: absolute; inset: 0; pointer-events: none;
        background: linear-gradient(180deg, color-mix(in srgb, var(--nocturne-ink) 4%, transparent) 0%, transparent 36%, color-mix(in srgb, var(--nocturne-ink) 14%, transparent) 56%, color-mix(in srgb, var(--nocturne-ink) 82%, transparent) 82%, var(--nocturne-ink) 100%);
      }
      ${fresh} [data-slot="aui_intro"] { display: none !important; }
      ${fresh} [data-slot="composer-dock"]:not([data-popped-out]) { bottom: clamp(24px, 5.2vh, 64px); }
      ${root} {
        --composer-fill: var(--nocturne-surface) !important;
        --composer-surface-pad-x: 24px;
        --composer-surface-pad-y: 20px;
        --composer-input-min-height: 72px;
        --composer-input-max-height: min(30vh, 280px);
        --composer-control-size: 32px;
        --composer-control-gap: 12px;
        --composer-row-gap: 12px;
        border-radius: 16px;
      }
      ${root} [data-slot="composer-surface"] {
        min-height: 164px; overflow: visible; border-color: var(--nocturne-border) !important;
        box-shadow: 0 16px 48px color-mix(in srgb, var(--nocturne-ink) 40%, transparent);
      }
      ${root}:not([data-drag-active]):focus-within [data-slot="composer-surface"] { border-color: var(--nocturne-accent) !important; }
      ${root} [data-slot="composer-fade"] { overflow: visible; }
      ${root} [data-slot="composer-fade"] > .grid {
        grid-template-columns: auto minmax(0, 1fr);
        grid-template-areas: 'input input' 'menu controls'; gap: 12px;
      }
      ${root} [data-slot="composer-rich-input"] { padding-left: 0; font-size: 20px; line-height: 28px; color: var(--nocturne-text); }
      ${root} [data-slot="composer-rich-input"]::before { color: color-mix(in srgb, var(--nocturne-text) 70%, var(--nocturne-muted)); }
      ${root} [data-slot="composer-rich-input"]:is(:empty,[data-empty])::after {
        content: '/ for commands · @ for context'; position: absolute; top: 40px; left: 0; pointer-events: none;
        font-size: 13px; line-height: 20px; color: var(--nocturne-muted);
      }
      ${root} [class*="grid-area:controls"] { justify-content: stretch; }
      ${root} [class*="grid-area:controls"] > div:last-child { flex: 1; }
      ${root} [class*="grid-area:controls"] > div:last-child > span:has(button.bg-foreground) { margin-left: auto; }
      ${root} [data-tour$="model-pill"] { color: var(--nocturne-accent); font-size: 14px; max-width: 240px; }
      ${root} [data-tour$="model-pill"] + button { margin-right: auto; }
      ${root} button.bg-foreground { margin-left: auto; border-radius: 11px; background: var(--nocturne-accent); color: var(--nocturne-ink); width: 40px; height: 40px; }
      ${root} button.bg-foreground:disabled { opacity: .45; }
      ${root} .nocturne-settings { display: flex; align-items: center; justify-content: center; width: 28px; height: 32px; color: var(--nocturne-muted); cursor: pointer; }
      ${root} .nocturne-context { display: none; }
      html.dark.hermes-nocturne [data-chat-surface][data-fresh-draft][data-composer-target="main"] [data-slot="composer-root"]:not([data-popped-out]) .nocturne-context {
        display: flex; position: absolute; left: 24px; bottom: calc(100% + 16px); gap: 18px; height: 26px; max-width: calc(100% - 48px); color: var(--nocturne-text); font-size: 14px;
      }
      .nocturne-context button { display: flex; min-width: 0; align-items: center; gap: 8px; cursor: pointer; }
      .nocturne-context button:first-child > .codicon:first-child { color: var(--nocturne-accent); }
      .nocturne-project-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
      .nocturne-divider { width: 1px; height: 14px; background: var(--nocturne-border); }
      .nocturne-title button:focus-visible, .nocturne-context button:focus-visible, .nocturne-settings:focus-visible { outline: 2px solid var(--nocturne-accent); outline-offset: 4px; }
      @media (max-width: 720px) {
        .nocturne-wordmark, .nocturne-title .nocturne-new-chat { display: none; }
        ${root} { --composer-surface-pad-x: 16px; --composer-control-gap: 8px; }
        ${root} [data-slot="composer-rich-input"] { font-size: 17px; }
        .nocturne-project-name { max-width: 140px; }
      }
      @media (max-height: 640px) {
        ${fresh} [data-slot="composer-dock"]:not([data-popped-out]) { bottom: 0; }
        ${root} { --composer-input-min-height: 48px; --composer-surface-pad-y: 12px; }
        ${root} [data-slot="composer-surface"] { min-height: 124px; }
        ${root} [data-slot="composer-rich-input"]::after { display: none; }
      }
    `
    document.head.append(style)
    html.classList.add('hermes-nocturne')
    ctx.register({ id: 'title', area: 'titleBar.center', render: Title })
    ctx.register({ id: 'context', area: 'composer.top', render: ContextRow })
    ctx.register({ id: 'settings', area: 'composer.leading', render: () => button({ className: 'nocturne-settings', 'aria-label': 'Chat settings', onClick: () => host.navigate('/settings') }, [glyph('settings-gear')]) })
    ctx.onDispose(() => { style.remove(); html.classList.remove('hermes-nocturne') })
  }
}
