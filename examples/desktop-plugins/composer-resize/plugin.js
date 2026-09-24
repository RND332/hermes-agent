/** Standalone Hermes Desktop plugin. Drag either composer edge; double-click to reset. */
const ROOT = '[data-slot="composer-root"]'
const DOCK = '[data-slot="composer-dock"]'
const WIDTH = '--hermes-composer-resize-width'
const KEY = 'width'

export default {
  id: 'composer-resize',
  name: 'Resizable composer',
  register(ctx) {
    const html = document.documentElement
    const saved = ctx.storage.get(KEY, null)
    let preferred = typeof saved === 'number' && Number.isFinite(saved) && saved > 0 ? saved : null
    let cancelDrag = null
    const mounted = new Map()
    const apply = value => {
      preferred = value === null ? null : Math.max(320, value)
      if (preferred === null) html.style.removeProperty(WIDTH)
      else html.style.setProperty(WIDTH, `${preferred}px`)
    }
    const save = () => ctx.storage.set(KEY, preferred)
    const reset = () => { cancelDrag?.(); apply(null); save() }
    const style = document.createElement('style')
    style.textContent = `
      ${DOCK}:not([data-popped-out]) {
        width: calc(min(var(${WIDTH}, var(--composer-width)), calc(100% - 2rem)) + 10px);
      }
      [data-slot="aui_thread-content"] {
        max-width: var(${WIDTH}, var(--composer-width));
      }
      [data-composer-resize] {
        position: absolute; top: 12px; bottom: 12px; width: 10px; z-index: 10;
        cursor: ew-resize; touch-action: none; user-select: none;
        -webkit-app-region: no-drag;
      }
      [data-composer-resize="left"] { left: 0; }
      [data-composer-resize="right"] { right: 0; }
      [data-composer-resize]::after {
        content: ''; position: absolute; top: 15%; bottom: 15%; left: 4px;
        width: 2px; border-radius: 2px; background: var(--ui-accent); opacity: 0;
      }
      [data-composer-resize]:hover::after, [data-composer-resize]:focus-visible::after,
      [data-composer-resize][data-resizing]::after { opacity: .7; }
      ${DOCK}[data-popped-out] [data-composer-resize],
      .hud-native-drag [data-composer-resize] { display: none; }
      html[data-composer-resizing], html[data-composer-resizing] * {
        cursor: ew-resize !important; user-select: none !important;
      }
    `
    document.head.append(style)
    apply(preferred)

    function mount(root) {
      const dock = root.closest(DOCK)
      if (!dock || mounted.has(root)) return
      const controller = new AbortController()
      const { signal } = controller
      const handles = []
      const limits = () => {
        const max = Math.max(0, (dock.offsetParent?.clientWidth ?? window.innerWidth) - 2 * parseFloat(getComputedStyle(html).fontSize))
        return { min: Math.min(320, max), max }
      }
      const clamp = value => { const { min, max } = limits(); return Math.min(max, Math.max(min, value)) }
      for (const side of ['left', 'right']) {
        const handle = document.createElement('div')
        const direction = side === 'left' ? -1 : 1
        handle.dataset.composerResize = side
        handle.title = 'Drag to resize input · Double-click to reset'
        handle.setAttribute('role', 'separator')
        handle.setAttribute('aria-orientation', 'vertical')
        handle.setAttribute('aria-label', `Resize input from ${side} edge`)
        handle.tabIndex = 0
        handle.addEventListener('dblclick', event => { event.preventDefault(); event.stopPropagation(); reset() }, { signal })
        handle.addEventListener('keydown', event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return
          event.preventDefault(); event.stopPropagation()
          if (event.key === 'Home') reset()
          else { apply(clamp(dock.getBoundingClientRect().width - 10 + (event.key === 'ArrowRight' ? 20 : -20) * direction)); save() }
        }, { signal })
        handle.addEventListener('pointerdown', event => {
          if (event.button !== 0 || dock.hasAttribute('data-popped-out')) return
          event.preventDefault(); event.stopPropagation()
          cancelDrag?.()
          const previous = preferred
          const startX = event.clientX
          const startWidth = dock.getBoundingClientRect().width - 10
          const { min, max } = limits()
          const drag = new AbortController()
          const pointer = event.pointerId
          handle.setPointerCapture(pointer)
          handle.dataset.resizing = ''
          html.dataset.composerResizing = ''
          const finish = commit => {
            drag.abort()
            if (handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer)
            delete handle.dataset.resizing
            delete html.dataset.composerResizing
            cancelDrag = null
            if (commit) save()
            else apply(previous)
          }
          cancelDrag = () => finish(false)
          window.addEventListener('pointermove', move => {
            if (move.pointerId === pointer) apply(Math.min(max, Math.max(min, startWidth + 2 * direction * (move.clientX - startX))))
          }, { signal: drag.signal })
          window.addEventListener('pointerup', up => { if (up.pointerId === pointer) finish(true) }, { signal: drag.signal })
          window.addEventListener('pointercancel', cancel => { if (cancel.pointerId === pointer) finish(false) }, { signal: drag.signal })
          window.addEventListener('blur', () => finish(false), { signal: drag.signal })
          handle.addEventListener('lostpointercapture', () => finish(false), { signal: drag.signal })
        }, { signal })
        root.append(handle)
        handles.push(handle)
      }
      mounted.set(root, () => { controller.abort(); handles.forEach(handle => handle.remove()) })
    }

    // Inspect only added subtrees, not the whole transcript on each streamed token.
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        if (node.matches(ROOT)) mount(node)
        node.querySelectorAll(ROOT).forEach(mount)
      }
      for (const [root, dispose] of mounted) if (!root.isConnected) {
        if (root.querySelector('[data-resizing]')) cancelDrag?.()
        dispose(); mounted.delete(root)
      }
    })
    document.querySelectorAll(ROOT).forEach(mount)
    observer.observe(document.body, { childList: true, subtree: true })
    ctx.onDispose(() => {
      observer.disconnect()
      cancelDrag?.()
      mounted.forEach(dispose => dispose())
      mounted.clear()
      style.remove()
      html.style.removeProperty(WIDTH)
    })
  }
}
