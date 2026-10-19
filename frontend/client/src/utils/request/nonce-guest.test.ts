import { beforeEach, describe, expect, it, vi } from 'vitest'

import { nonceHeader, setNonce } from './nonce'
import { request } from './request'
import { wpApi } from './wp-api'

// A guest's page carries no nonce, so a page cache can keep it for any length
// of time. WordPress checks every X-WP-Nonce it gets, and an empty or expired
// one fails with "Cookie check failed" — so a guest must send no header at all.
vi.mock('@config/config', () => ({
  default: {
    API_URL: 'https://example.test/wp-json/bit-connect/v1/',
    NONCE: '',
    WP_REST_URL: 'https://example.test/wp-json/wp/v2/'
  }
}))

const sentHeaders = () =>
  (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as {
    headers: Record<string, string>
  }

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({}),
      ok: true,
      status: 200
    })
  )
})

describe('a guest with no nonce', () => {
  it('sends no nonce header to the plugin API', async () => {
    await request('topics', { method: 'GET' })

    expect(sentHeaders().headers).not.toHaveProperty('X-WP-Nonce')
  })

  it('sends no nonce header to the WordPress API', async () => {
    await wpApi('comments', { method: 'GET' })

    expect(sentHeaders().headers).not.toHaveProperty('X-WP-Nonce')
  })

  it('has no header to give the other request helpers', () => {
    expect(nonceHeader()).toEqual({})
  })

  // Login hands back a nonce for the new session; from then on it is sent.
  it('sends the nonce once a login hands one over', async () => {
    setNonce('nonce-after-login')

    await request('topics', { method: 'GET' })

    expect(sentHeaders().headers['X-WP-Nonce']).toBe('nonce-after-login')
  })
})
