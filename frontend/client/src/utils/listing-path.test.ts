import config from '@config/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { archivePath, isListingPath } from './listing-path'

const original = { TRAILING_SLASH: config.TRAILING_SLASH }

function setConfig(values: Partial<typeof original>) {
  Object.assign(config as typeof original, values)
}

describe('archivePath', () => {
  beforeEach(() => setConfig({ TRAILING_SLASH: false }))
  afterEach(() => setConfig(original))

  it("opens the term's archive, under the segment that serves its filter", () => {
    expect(archivePath('tags', 'api')).toBe('/tag/api')
    expect(archivePath('topic-types', 'question')).toBe('/topic/question')
  })

  it("keeps the site's permalink form", () => {
    setConfig({ TRAILING_SLASH: true })

    expect(archivePath('tags', 'api')).toBe('/tag/api/')
  })

  // A filter no archive serves has only the listing to land on.
  it('falls back to the filtered listing for a filter without an archive', () => {
    expect(archivePath('departments', 'platform')).toBe('/?departments=platform')
  })
})

describe('isListingPath', () => {
  it('recognises the root, a deeper page and a term archive', () => {
    expect(isListingPath('/')).toBe(true)
    expect(isListingPath('/page/2')).toBe(true)
    expect(isListingPath('/tag/api')).toBe(true)
    expect(isListingPath('/how-do-i')).toBe(false)
  })
})
