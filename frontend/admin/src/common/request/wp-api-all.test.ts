import { afterEach, describe, expect, it, vi } from 'vitest'

import { wpApiAll } from './wp-api-all'

vi.mock('@config/config', () => ({
  default: { NONCE: 'test-nonce', WP_REST_URL: 'https://example.test/wp-json/wp/v2' }
}))

const terms = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: from + index, name: `Tag ${from + index}` }))

/** Answers each request from the page it asks for, as WordPress does. */
const pages = (total: number) =>
  vi.fn((url: URL) => {
    const page = Number(url.searchParams.get('page'))
    const perPage = Number(url.searchParams.get('per_page'))
    const start = (page - 1) * perPage
    if (page > 1 && start >= total) {
      return Promise.resolve({
        json: () => Promise.resolve({ code: 'rest_term_invalid_page_number', data: { status: 400 } }),
        ok: false,
        status: 400
      })
    }
    return Promise.resolve({
      json: () => Promise.resolve(terms(start + 1, Math.min(perPage, total - start))),
      ok: true,
      status: 200
    })
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('wpApiAll()', () => {
  it('reads one request when the list fits in a page', async () => {
    const fetch = pages(28)
    vi.stubGlobal('fetch', fetch)

    await expect(wpApiAll('bit-connect-tags')).resolves.toHaveLength(28)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  // The bug this guards: the Tags screen read one page of 100, and the 101st
  // tag onwards never reached it — nor its search, nor its Pending count.
  it('keeps reading past 100 until a page comes back short', async () => {
    vi.stubGlobal('fetch', pages(230))

    const all = await wpApiAll<{ id: number }>('bit-connect-tags')

    expect(all).toHaveLength(230)
    expect(all.at(-1)?.id).toBe(230)
  })

  // A list of exactly 100 asks for a second page. Term collections answer it
  // empty; post collections refuse it. Either ends the list.
  it('ends a list of exactly 100 at an empty second page', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ json: () => Promise.resolve(terms(1, 100)), ok: true, status: 200 })
      .mockResolvedValueOnce({ json: () => Promise.resolve([]), ok: true, status: 200 })
    vi.stubGlobal('fetch', fetch)

    await expect(wpApiAll('bit-connect-tags')).resolves.toHaveLength(100)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('ends a list of exactly 100 at a refused second page', async () => {
    vi.stubGlobal('fetch', pages(100))

    await expect(wpApiAll('bit-connect-tags')).resolves.toHaveLength(100)
  })

  it('still fails when the first page fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ code: 'rest_forbidden' }),
        ok: false,
        status: 403
      })
    )

    await expect(wpApiAll('bit-connect-tags')).rejects.toEqual({ errors: { code: 'rest_forbidden' } })
  })
})
