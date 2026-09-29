import config from '@config/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { listingLink } from './listing-link'

const original = {
  DEFAULT_STAGE_SLUG: config.DEFAULT_STAGE_SLUG,
  DEPARTMENT_NAMING: config.DEPARTMENT_NAMING,
  TRAILING_SLASH: config.TRAILING_SLASH
}

function setConfig(values: Partial<typeof original>) {
  Object.assign(config as typeof original, values)
}

describe('listingLink', () => {
  beforeEach(() =>
    setConfig({
      DEFAULT_STAGE_SLUG: 'questions',
      DEPARTMENT_NAMING: { ...original.DEPARTMENT_NAMING, slug: 'department' },
      TRAILING_SLASH: true
    })
  )
  afterEach(() => setConfig(original))

  it('opens the portal root when nothing is chosen', () => {
    expect(listingLink({})).toBe('/')
  })

  it("opens a stage's archive, and the root for the default stage", () => {
    expect(listingLink({ stage: 'planned' })).toBe('/stage/planned/')
    expect(listingLink({ stage: 'questions' })).toBe('/')
  })

  it("opens a department's archive", () => {
    expect(listingLink({ department: 'mobile-app' })).toBe('/department/mobile-app/')
  })

  it("narrows the department's archive by stage, the default one included", () => {
    expect(listingLink({ department: 'mobile-app', stage: 'planned' })).toBe(
      '/department/mobile-app/?stage=planned'
    )
    expect(listingLink({ department: 'mobile-app', stage: 'questions' })).toBe(
      '/department/mobile-app/?stage=questions'
    )
  })

  it('follows the segment the portal renamed departments to', () => {
    setConfig({ DEPARTMENT_NAMING: { ...original.DEPARTMENT_NAMING, slug: 'product' } })

    expect(listingLink({ department: 'mobile-app' })).toBe('/product/mobile-app/')
  })

  it("follows the site's permalink form", () => {
    setConfig({ TRAILING_SLASH: false })

    expect(listingLink({ department: 'mobile-app', stage: 'planned' })).toBe(
      '/department/mobile-app?stage=planned'
    )
  })
})
