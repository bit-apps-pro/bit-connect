import { describe, expect, it, vi } from 'vitest'

import { preloadKey, takePreloaded } from './preload'
import { request } from './request'
import { wpApi } from './wp-api'

// The page global BaseView prints, with the answers PortalPreload put in it.
// Tests have no build `define` for SERVER_VARIABLES, so it is set directly.
vi.hoisted(() => {
  ;(globalThis as { SERVER_VARIABLES?: unknown }).SERVER_VARIABLES = {
    apiURL: 'https://example.test/wp-json/bit-connect/v1',
    preload: {
      '/bit-connect/v1/posts/7/comments?page=1&per_page=10&sort=newest': { data: { data: [] } },
      '/bit-connect/v1/settings': { data: { from: 'page' } },
      '/bit-connect/v1/topics?name=hello-world': { data: { data: [{ ID: 7 }] } },
      '/wp/v2/bit-connect-stages?per_page=100': [{ id: 1, name: 'Ideas' }]
    },
    wpRestURL: 'https://example.test/wp-json/wp/v2'
  }
})

vi.mock('@config/config', () => ({
  default: {
    API_URL: 'https://example.test/wp-json/bit-connect/v1/',
    NONCE: '',
    WP_REST_URL: 'https://example.test/wp-json/wp/v2/'
  }
}))

describe('the key of a request', () => {
  it('is the route without the /wp-json prefix', () => {
    expect(preloadKey(new URL('https://example.test/wp-json/bit-connect/v1/settings'))).toBe(
      '/bit-connect/v1/settings'
    )
  })

  it('does not depend on the order of the query', () => {
    expect(preloadKey(new URL('https://example.test/wp-json/bit-connect/v1/c?sort=newest&page=1'))).toBe(
      preloadKey(new URL('https://example.test/wp-json/bit-connect/v1/c?page=1&sort=newest'))
    )
  })

  it('reads the route from ?rest_route= on a site with plain permalinks', () => {
    expect(preloadKey(new URL('https://example.test/?rest_route=/bit-connect/v1/topics&name=a'))).toBe(
      '/bit-connect/v1/topics?name=a'
    )
  })

  it('keeps the path of a site installed below the domain root', () => {
    expect(preloadKey(new URL('https://example.test/blog/wp-json/wp/v2/tags?per_page=5'))).toBe(
      '/wp/v2/tags?per_page=5'
    )
  })
})

describe('an answer the page carries', () => {
  it('is served for the first request that asks for it, without the network', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    const topic = await request('topics', { method: 'GET', queryParam: { name: 'hello-world' } })

    expect(topic).toEqual({ data: { data: [{ ID: 7 }] } })
    expect(fetch).not.toHaveBeenCalled()
  })

  // A later request — a refresh after a write — must reach the server.
  it('is served once, and the next request goes to the server', async () => {
    const fetch = vi.fn().mockResolvedValue({
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ data: { from: 'server' } }),
      ok: true,
      status: 200
    })
    vi.stubGlobal('fetch', fetch)

    await expect(request('settings', { method: 'GET' })).resolves.toEqual({ data: { from: 'page' } })
    await expect(request('settings', { method: 'GET' })).resolves.toEqual({ data: { from: 'server' } })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('serves a WordPress API request in the shape the network one returns', async () => {
    vi.stubGlobal('fetch', vi.fn())

    const stages = await wpApi('bit-connect-stages', { method: 'GET', queryParam: { per_page: 100 } })

    expect(stages).toEqual({ data: [{ id: 1, name: 'Ideas' }] })
  })

  it('is never served for a write', () => {
    const url = new URL('https://example.test/wp-json/bit-connect/v1/posts/7/comments?page=1&per_page=10&sort=newest')

    expect(takePreloaded(url, 'POST')).toBeUndefined()
    expect(takePreloaded(url, 'GET')).toEqual({ data: { data: [] } })
  })

  it('is not served for a request it does not match exactly', () => {
    expect(takePreloaded(new URL('https://example.test/wp-json/bit-connect/v1/topics?name=other'))).toBeUndefined()
  })
})
