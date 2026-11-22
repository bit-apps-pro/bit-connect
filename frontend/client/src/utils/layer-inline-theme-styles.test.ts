import { afterEach, describe, expect, it } from 'vitest'

import { layerInlineThemeStyles } from './layer-inline-theme-styles'

// A theme's inline CSS sits outside every layer, so it beats the portal's
// antd and Tailwind layers and repaints the portal's buttons and inputs.
function addStyle(id: string, css: string) {
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.append(style)
  return style
}

afterEach(() => {
  document.head.innerHTML = ''
})

describe('layerInlineThemeStyles', () => {
  it('moves a theme inline style into the wp layer', () => {
    const style = addStyle('astra-theme-css-inline-css', 'button{background:blue}')

    layerInlineThemeStyles()

    expect(style.textContent).toBe('@layer wp{button{background:blue}}')
  })

  it('keeps the plugin’s own inline styles outside the layer', () => {
    const style = addStyle('bit-connect-pre-paint-inline-css', '.bc-ssr{color:red}')

    layerInlineThemeStyles()

    expect(style.textContent).toBe('.bc-ssr{color:red}')
  })

  it('leaves styles that WordPress did not print', () => {
    const style = addStyle('', 'button{color:red}')

    layerInlineThemeStyles()

    expect(style.textContent).toBe('button{color:red}')
  })

  it('leaves a block with @import, which a layer block cannot hold', () => {
    const css = "@import url('a.css');button{color:red}"
    const style = addStyle('theme-inline-css', css)

    layerInlineThemeStyles()

    expect(style.textContent).toBe(css)
  })

  it('wraps a block only once', () => {
    const style = addStyle('theme-inline-css', 'a{color:red}')

    layerInlineThemeStyles()
    layerInlineThemeStyles()

    expect(style.textContent).toBe('@layer wp{a{color:red}}')
  })
})
