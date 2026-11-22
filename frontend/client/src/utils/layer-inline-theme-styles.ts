/**
 * Move the inline styles that WordPress prints into the `wp` cascade layer.
 *
 * useAppEssentials() moves every theme <link> into `@layer wp`, below the
 * portal's antd and Tailwind layers. It does not touch inline <style> blocks,
 * and CSS outside a layer wins over every layer, whatever its specificity. A
 * theme that prints its rules inline — Astra prints 60 KB as
 * `astra-theme-css-inline-css` — then paints every portal button with the
 * theme's button colour and padding.
 *
 * WordPress prints each enqueued inline style as `<style id="{handle}-inline-css">`,
 * so the id marks the blocks that belong to the theme and other plugins. The
 * plugin's own blocks keep their place: they style the server-rendered page
 * before the app mounts.
 */
const LAYERED = 'data-bc-layered'

export function layerInlineThemeStyles(ownPrefix = 'bit-connect', doc: Document = document) {
  const styles = doc.querySelectorAll<HTMLStyleElement>('style[id$="-inline-css"]')

  for (const style of styles) {
    if (style.id.startsWith(ownPrefix) || style.hasAttribute(LAYERED)) continue

    const css = style.textContent ?? ''
    // @import and @charset are not valid inside a layer block. Leave such a
    // block as it is rather than drop its imports.
    if (css.trim() === '' || /@import|@charset/i.test(css)) continue

    style.textContent = `@layer wp{${css}}`
    style.setAttribute(LAYERED, '')
  }
}
