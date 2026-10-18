import config from '@config/config'
import { afterEach, describe, expect, it } from 'vitest'

import { routePath } from './route-path'

const original = config.TRAILING_SLASH

function setTrailingSlash(value: boolean) {
  ;(config as { TRAILING_SLASH: boolean }).TRAILING_SLASH = value
}

describe('routePath', () => {
  afterEach(() => setTrailingSlash(original))

  it('adds the slash on a site whose permalinks end in one', () => {
    setTrailingSlash(true)

    expect(routePath('/how-do-i')).toBe('/how-do-i/')
    expect(routePath('/stage/planned')).toBe('/stage/planned/')
    expect(routePath('how-do-i')).toBe('/how-do-i/')
  })

  it('leaves it off on a site whose permalinks do not', () => {
    setTrailingSlash(false)

    expect(routePath('/how-do-i/')).toBe('/how-do-i')
    expect(routePath('/stage/planned')).toBe('/stage/planned')
  })

  it('keeps the query string and fragment after the path', () => {
    setTrailingSlash(true)

    expect(routePath('/login?redirect=%2Fhow-do-i')).toBe('/login/?redirect=%2Fhow-do-i')
    expect(routePath('/how-do-i#comment-4')).toBe('/how-do-i/#comment-4')
  })

  it('leaves the root as the root', () => {
    setTrailingSlash(true)
    expect(routePath('/')).toBe('/')
    expect(routePath('')).toBe('/')
    expect(routePath('/?sort=newest')).toBe('/?sort=newest')

    setTrailingSlash(false)
    expect(routePath('/')).toBe('/')
  })
})
