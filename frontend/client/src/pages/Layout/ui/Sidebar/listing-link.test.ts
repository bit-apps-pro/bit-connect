import config from '@config/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { listingLink } from './listing-link'

const original = {
  DEFAULT_STAGE_SLUG: config.DEFAULT_STAGE_SLUG,
  TRAILING_SLASH: config.TRAILING_SLASH
}

function setConfig(values: Partial<typeof original>) {
  Object.assign(config as typeof original, values)
}

describe('listingLink', () => {
  beforeEach(() => setConfig({ DEFAULT_STAGE_SLUG: 'questions', TRAILING_SLASH: true }))
  afterEach(() => setConfig(original))

  it('opens the portal root when nothing is chosen', () => {
    expect(listingLink({})).toBe('/')
  })

  it("opens a stage's archive, and the root for the default stage", () => {
    expect(listingLink({ stage: 'planned' })).toBe('/stage/planned/')
    expect(listingLink({ stage: 'questions' })).toBe('/')
  })

  it('opens the archive the listing is scoped to', () => {
    expect(listingLink({ scope: '/team/platform' })).toBe('/team/platform/')
  })

  it('narrows the scoped archive by stage, the default one included', () => {
    expect(listingLink({ scope: '/team/platform', stage: 'planned' })).toBe('/team/platform/?stage=planned')
    expect(listingLink({ scope: '/team/platform', stage: 'questions' })).toBe(
      '/team/platform/?stage=questions'
    )
  })

  it("follows the site's permalink form", () => {
    setConfig({ TRAILING_SLASH: false })

    expect(listingLink({ scope: '/team/platform', stage: 'planned' })).toBe('/team/platform?stage=planned')
  })
})
