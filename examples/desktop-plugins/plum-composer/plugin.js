export default {
  id: 'plum-composer',
  name: 'Plum composer',
  description: 'A roomier, plum-tinted dark composer. Keeps native controls, resizing and light mode.',
  register(ctx) {
    const style = document.createElement('style')
    style.id = 'plum-composer-style'
    const root = 'html.dark [data-slot="composer-root"]:not([data-popped-out]):not(.hud-native-drag)'
    style.textContent = `
      ${root} {
        --plum-composer-tint: color-mix(in srgb, var(--ui-purple) 75%, var(--ui-red));
        --composer-fill: color-mix(in srgb, var(--ui-bg-editor) 83%, var(--plum-composer-tint)) !important;
        --composer-surface-pad-x: 0.875rem;
        --composer-surface-pad-y: 0.75rem;
        --composer-input-min-height: 2rem;
        border-radius: 0.875rem;
      }
      ${root}:not([data-drag-active]) [data-slot="composer-surface"] {
        border-color: color-mix(in srgb, var(--ui-text-primary) 20%, var(--composer-fill)) !important;
        box-shadow: 0 8px 28px color-mix(in srgb, var(--ui-bg-chrome) 35%, transparent);
      }
      ${root}:not([data-drag-active]):focus-within [data-slot="composer-surface"] {
        border-color: color-mix(in srgb, var(--ui-purple) 65%, var(--composer-fill)) !important;
      }
    `
    document.head.append(style)
    ctx.onDispose(() => style.remove())
  }
}
