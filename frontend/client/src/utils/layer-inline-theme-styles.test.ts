import { afterEach, describe, expect, it } from 'vitest'

import { hasBalancedBraces, layerInlineThemeStyles } from './layer-inline-theme-styles'

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

  it('leaves a block with @namespace, which a layer block cannot hold', () => {
    const css = '@namespace svg url(http://www.w3.org/2000/svg);a{color:red}'
    const style = addStyle('theme-inline-css', css)

    layerInlineThemeStyles()

    expect(style.textContent).toBe(css)
  })

  it('puts the text back when a stray brace would end the layer early', () => {
    const css = 'a{color:red}}button{color:blue}'
    const style = addStyle('theme-inline-css', css)

    layerInlineThemeStyles()

    expect(style.textContent).toBe(css)
    expect(style.dataset.bcLayered).toBeUndefined()
  })

  it('wraps a block only once', () => {
    const style = addStyle('theme-inline-css', 'a{color:red}')

    layerInlineThemeStyles()
    layerInlineThemeStyles()

    expect(style.textContent).toBe('@layer wp{a{color:red}}')
  })
})

describe('hasBalancedBraces', () => {
  it.each([
    ['a{color:red}', true],
    ['@media (min-width:1px){a{color:red}}', true],
    ['a{content:"}"}', true],
    ["a{content:'{'}", true],
    ['/* } */a{color:red}', true],
    [String.raw`a{content:"\""}`, true],
    ['a{color:red}}', false],
    ['a{color:red', false],
    ['/* open comment a{}', false],
    ['a{content:"open}', false]
  ])('%s → %s', (css, expected) => {
    expect(hasBalancedBraces(css)).toBe(expected)
  })
})
