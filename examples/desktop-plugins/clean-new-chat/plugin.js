export default {
  id: 'clean-new-chat',
  name: 'Clean new chat',
  description: 'Hide the new-chat wordmark and tagline, leaving the composer and wallpaper alone.',
  register(ctx) {
    const style = document.createElement('style')
    style.textContent = '[data-slot="aui_intro"] { display: none !important; }'
    document.head.append(style)
    ctx.onDispose(() => style.remove())
  }
}
