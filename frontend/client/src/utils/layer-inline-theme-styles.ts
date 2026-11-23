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

/** Whether every `{` has its `}`, outside comments and quoted strings. */
export function hasBalancedBraces(css: string) {
  let depth = 0
  let quote = ''

  for (let i = 0; i < css.length; i++) {
    const char = css[i]

    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = ''
      continue
    }

    if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end === -1) return false
      i = end + 1
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '{') {
      depth++
    } else if (char === '}' && --depth < 0) {
      return false
    }
  }

  return depth === 0 && quote === ''
}

export function layerInlineThemeStyles(ownPrefix = 'bit-connect', doc: Document = document) {
  const styles = doc.querySelectorAll<HTMLStyleElement>('style[id$="-inline-css"]')

  for (const style of styles) {
    if (style.id.startsWith(ownPrefix) || style.hasAttribute(LAYERED)) continue

    const css = style.textContent ?? ''
    // @import, @charset and @namespace are not valid inside a layer block.
    // Leave such a block as it is rather than drop those rules.
    if (css.trim() === '' || /@import|@charset|@namespace/i.test(css)) continue
    // Browsers forgive a stray `}` in a theme's CSS. Inside the wrapper it
    // would close the layer early, and the rules after it would leave the
    // layer. Leave such a block as it is.
    if (!hasBalancedBraces(css)) continue

    style.textContent = `@layer wp{${css}}`
    style.setAttribute(LAYERED, '')
  }
}
