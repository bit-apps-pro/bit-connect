import { afterEach, describe, expect, it, vi } from 'vitest'

import { request } from './request'

vi.mock('@config/config', () => ({
  default: { API_URL: 'https://example.test/wp-json/bit-connect/v1', NONCE: 'test-nonce' }
}))

/** A fetch answer with the envelope the plugin's REST layer actually sends. */
const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('admin request()', () => {
  it('returns the body of a successful response', async () => {
    vi.stubGlobal('fetch', respond(200, { code: 'SUCCESS', data: { closed: 2 }, status: 'success' }))

    await expect(request('reports/resolve', { method: 'POST' })).resolves.toEqual({
      code: 'SUCCESS',
      data: { closed: 2 },
      status: 'success'
    })
  })

  // The bug this guards: the body of a 4xx used to be returned as though it had
  // succeeded, so callers ran their success path over a refusal — resolving a
  // report that no longer existed announced "Closed 0 report(s)" in a green
  // toast, and the reason the server wrote was shown to nobody.
  it('throws the refusal on a 4xx instead of returning it as a result', async () => {
    vi.stubGlobal(
      'fetch',
      respond(404, {
        code: 'ERROR',
        data: [],
        message: 'There is nothing left to review on this.',
        status: 'error'
      })
    )

    await expect(request('reports/resolve', { method: 'POST' })).rejects.toMatchObject({
      message: 'There is nothing left to review on this.',
      status: 'error'
    })
  })

  it('throws on a 5xx as well', async () => {
    vi.stubGlobal('fetch', respond(500, { message: 'Something broke.', status: 'error' }))

    await expect(request('reports', { method: 'GET' })).rejects.toMatchObject({
      message: 'Something broke.'
    })
  })

  // A refusal the server explained must not be re-wrapped on its way through the
  // catch, or the caller reads `errors` and never finds the message.
  it('keeps a server refusal intact rather than wrapping it as a transport error', async () => {
    vi.stubGlobal(
      'fetch',
      respond(422, { message: 'Choose what to do with the report.', status: 'error' })
    )

    await expect(request('reports/resolve', { method: 'POST' })).rejects.not.toHaveProperty('errors')
  })

  it('still wraps a genuine transport failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(request('reports', { method: 'GET' })).rejects.toHaveProperty('errors')
  })
})
