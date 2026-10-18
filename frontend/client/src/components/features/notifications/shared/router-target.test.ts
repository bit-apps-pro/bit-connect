import config from '@config/config'
import { afterEach, describe, expect, it } from 'vitest'

import routerTarget from './router-target'

const original = config.POST_URL

function setBase(value: string) {
  ;(config as { POST_URL: string }).POST_URL = value
}

const at = (path: string) => new URL(path, 'https://example.com')

describe('routerTarget', () => {
  afterEach(() => setBase(original))

  it('takes the portal basename off, so the router does not add it twice', () => {
    setBase('/portal')

    expect(routerTarget(at('/portal/how-do-i/#comment-4'))).toBe('/how-do-i/#comment-4')
    expect(routerTarget(at('/portal/'))).toBe('/')
    expect(routerTarget(at('/portal'))).toBe('/')
  })

  it('hands a path outside the portal back to the browser', () => {
    setBase('/portal')

    expect(routerTarget(at('/bit-connect/how-do-i/'))).toBeUndefined()
    expect(routerTarget(at('/portal-old/how-do-i/'))).toBeUndefined()
  })

  it('keeps the whole path when the portal is served at the root', () => {
    setBase('/')

    expect(routerTarget(at('/how-do-i/?page=2#comment-4'))).toBe('/how-do-i/?page=2#comment-4')
  })
})
