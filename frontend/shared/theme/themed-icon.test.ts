import { describe, expect, it } from 'vitest'

import { pickThemedIcon } from './themed-icon'

// WordPress returns '' for a registered string meta that was never set — the
// REST default — so every check has to treat empty as absent rather than as a
// value. An `<img src="">` re-requests the page itself in some browsers.
describe('pickThemedIcon', () => {
  it('uses the base icon in the light theme', () => {
    expect(pickThemedIcon({ icon_url: '/light.svg' }, false)).toBe('/light.svg')
  })

  it('uses the dark override when the admin uploaded one', () => {
    expect(pickThemedIcon({ icon_dark_url: '/dark.svg', icon_url: '/light.svg' }, true)).toBe(
      '/dark.svg'
    )
  })

  // Dark falls back to light, never the reverse: the base icon is the one every
  // term has, and the dark slot is an opt-in override.
  it('falls back to the base icon in the dark theme', () => {
    expect(pickThemedIcon({ icon_url: '/light.svg' }, true)).toBe('/light.svg')
  })

  it('never uses the dark override in the light theme', () => {
    expect(pickThemedIcon({ icon_dark_url: '/dark.svg' }, false)).toBeUndefined()
  })

  it('reads an unset meta as no icon rather than as an empty one', () => {
    expect(pickThemedIcon({ icon_dark_url: '', icon_url: '' }, false)).toBeUndefined()
    expect(pickThemedIcon({ icon_dark_url: '', icon_url: '' }, true)).toBeUndefined()
  })

  it('falls back to the base icon when only the dark slot is empty', () => {
    expect(pickThemedIcon({ icon_dark_url: '', icon_url: '/light.svg' }, true)).toBe('/light.svg')
  })

  it('answers nothing for a term with no icon at all', () => {
    expect(pickThemedIcon(undefined, false)).toBeUndefined()
    expect(pickThemedIcon({}, true)).toBeUndefined()
  })
})
