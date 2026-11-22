import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setCascadeLayerToWordpressStyles } from './themeUtils'

const ASSETS = 'https://example.test/wp-content/plugins/my-plugin/assets'

function addLink(href: string) {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.append(link)
  return link
}

function layerStyle() {
  return document.head.firstElementChild?.textContent ?? ''
}

const testVariables = { assetsURL: ASSETS, pluginSlug: 'my-plugin' }
interface Globals {
  SERVER_VARIABLES?: Record<string, unknown>
}
let saved: Record<string, unknown> | undefined

beforeEach(() => {
  // A plugin's test setup may already define the global, and not let a test
  // redefine it. Change its fields then, and put them back after.
  const globals = globalThis as Globals
  if (globals.SERVER_VARIABLES) {
    saved = { ...globals.SERVER_VARIABLES }
    Object.assign(globals.SERVER_VARIABLES, testVariables)
  } else {
    vi.stubGlobal('SERVER_VARIABLES', { ...testVariables })
  }
})

afterEach(() => {
  document.head.innerHTML = ''
  const globals = globalThis as Globals
  if (saved && globals.SERVER_VARIABLES) Object.assign(globals.SERVER_VARIABLES, saved)
  saved = undefined
  vi.unstubAllGlobals()
})

describe('setCascadeLayerToWordpressStyles', () => {
  it('imports a theme stylesheet into the wp layer once', () => {
    const href = 'https://example.test/wp-content/themes/astra/main.min.css'
    const link = addLink(href)
    // A browser lists a loaded <link> in document.styleSheets as well;
    // happy-dom does not load it, so give the sheet by hand.
    vi.spyOn(document, 'styleSheets', 'get').mockReturnValue([
      { disabled: false, href, ownerNode: link }
    ] as unknown as StyleSheetList)

    setCascadeLayerToWordpressStyles('@layer wp, antd;')

    const imports = layerStyle().match(/@import url\('[^']+astra\/main\.min\.css'\) layer\(wp\);/g)
    expect(imports).toHaveLength(1)
  })

  it('keeps the plugin’s own code-split chunks out of the wp layer', () => {
    const chunk = addLink(`${ASSETS}/client/my-plugin-ClTyMlQ6.css`)

    setCascadeLayerToWordpressStyles('@layer wp, antd;')

    expect(layerStyle()).not.toContain('ClTyMlQ6')
    expect(chunk.isConnected).toBe(true)
  })

  it('keeps the plugin’s entry stylesheet out of the wp layer', () => {
    addLink('https://example.test/elsewhere/main-my-plugin-ba-assets-x.css')

    setCascadeLayerToWordpressStyles('@layer wp, antd;')

    expect(layerStyle()).not.toContain('ba-assets')
  })
})
