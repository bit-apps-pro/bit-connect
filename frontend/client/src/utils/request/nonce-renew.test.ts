import { beforeEach, describe, expect, it, vi } from 'vitest'

import { nonceHeader, setNonce } from './nonce'
import { request } from './request'

// A nonce lives 12 to 24 hours. A tab open longer — or a page a cache kept for
// a signed-in member — holds one WordPress refuses, and every request failed
// with "Cookie check failed" until a reload. The client now asks core's
// `rest-nonce` action for a new one and sends the request again, once.
vi.mock('@config/config', () => ({
  default: {
    AJAX_URL: 'https://example.test/wp-admin/admin-ajax.php',
    API_URL: 'https://example.test/wp-json/bit-connect/v1/',
    NONCE: 'old-nonce1',
    WP_REST_URL: 'https://example.test/wp-json/wp/v2/'
  }
}))

const json = (status: number, body: unknown) => ({
  clone() {
    return json(status, body)
  },
  headers: { get: () => 'application/json' },
  json: () => Promise.resolve(body),
  ok: status >= 200 && status < 300,
  status
})

const text = (status: number, body: string) => ({
  ok: status >= 200 && status < 300,
  status,
  text: () => Promise.resolve(body)
})

const invalidNonce = () =>
  json(403, { code: 'rest_cookie_invalid_nonce', data: { status: 403 }, message: 'Cookie check failed' })

type FetchMock = ReturnType<typeof vi.fn>

const calls = () =>
  (globalThis.fetch as FetchMock).mock.calls as [string | URL, RequestInit | undefined][]

beforeEach(() => {
  setNonce('old-nonce1')
})

describe('an expired nonce', () => {
  it('is renewed and the request is sent again with the new one', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(invalidNonce())
        .mockResolvedValueOnce(text(200, 'a1b2c3d4e5'))
        .mockResolvedValueOnce(json(200, { data: 'ok' }))
    )

    const response = await request('topics', { method: 'GET' })

    expect(response).toEqual({ data: 'ok' })
    expect(String(calls()[1][0])).toBe('https://example.test/wp-admin/admin-ajax.php?action=rest-nonce')
    expect((calls()[2][1]?.headers as Record<string, string>)['X-WP-Nonce']).toBe('a1b2c3d4e5')
    expect(nonceHeader()).toEqual({ 'X-WP-Nonce': 'a1b2c3d4e5' })
  })

  // Core answers `0` once the login cookie is gone: the member was signed out.
  it('is dropped when the session has ended, and the request goes as a guest', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(invalidNonce())
        .mockResolvedValueOnce(text(400, '0'))
        .mockResolvedValueOnce(json(200, { data: 'guest view' }))
    )

    await request('topics', { method: 'GET' })

    expect(calls()[2][1]?.headers).not.toHaveProperty('X-WP-Nonce')
    expect(nonceHeader()).toEqual({})
  })

  it('is renewed only once, so a second refusal reaches the caller', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(invalidNonce())
        .mockResolvedValueOnce(text(200, 'a1b2c3d4e5'))
        .mockResolvedValueOnce(invalidNonce())
    )

    await expect(request('topics', { method: 'GET' })).rejects.toMatchObject({
      code: 'rest_cookie_invalid_nonce'
    })
    expect(calls()).toHaveLength(3)
  })
})

describe('any other refusal', () => {
  it('is not retried', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(403, { code: 'rest_forbidden' })))

    await expect(request('topics', { method: 'GET' })).rejects.toMatchObject({ code: 'rest_forbidden' })
    expect(calls()).toHaveLength(1)
  })
})
