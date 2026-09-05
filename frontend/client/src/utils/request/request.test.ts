/* eslint-disable translate-obj-prop/translate-obj-prop -- fixtures are wire data, not user-facing copy */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getNonce, setNonce } from './nonce'
import { request } from './request'
import { wpApi } from './wp-api'

vi.mock('@config/config', () => ({
  default: {
    API_URL: 'https://example.test/wp-json/bit-connect/v1/',
    NONCE: 'page-nonce',
    WP_REST_URL: 'https://example.test/wp-json/wp/v2/'
  }
}))

/** A fetch answer shaped like one the REST layer actually sends. */
function respond(
  status: number,
  body: unknown,
  { json = true }: { json?: boolean } = {}
): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    headers: { get: () => (json ? 'application/json; charset=UTF-8' : 'text/html') },
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 204 ? 'No Content' : 'Error'
  })
}

/** The RequestInit the code under test handed to fetch. */
const sentInit = () =>
  (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as RequestInit

const sentUrl = () =>
  String((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0])

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {
    /* silenced */
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setNonce('page-nonce')
})

describe('portal request()', () => {
  it('returns the body of a successful response', async () => {
    vi.stubGlobal('fetch', respond(200, { data: { id: 9 }, status: 'success' }))

    await expect(request('topics/9', { method: 'GET' })).resolves.toEqual({
      data: { id: 9 },
      status: 'success'
    })
  })

  it('joins the endpoint onto the API root without doubling the slash', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await request('topics', { method: 'GET' })

    expect(sentUrl()).toBe('https://example.test/wp-json/bit-connect/v1/topics')
  })

  it('takes an endpoint written with a leading slash too', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await request('/topics', { method: 'GET' })

    expect(sentUrl()).toBe('https://example.test/wp-json/bit-connect/v1/topics')
  })

  it('appends the query parameters it was given', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await request('topics', { method: 'GET', queryParam: { page: 2, stage: 'ideas' } })

    expect(sentUrl()).toContain('page=2')
    expect(sentUrl()).toContain('stage=ideas')
  })

  // The cookie the browser sends is what authenticates the request; without
  // this every call is anonymous however sound the nonce is.
  it('sends the session cookie and the nonce', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await request('topics', { method: 'GET' })

    const init = sentInit()

    expect(init.credentials).toBe('include')
    expect((init.headers as Record<string, string>)['X-WP-Nonce']).toBe('page-nonce')
  })

  it('sends a JSON body only on the verbs that carry one', async () => {
    vi.stubGlobal('fetch', respond(200, {}))
    await request('topics', { body: { title: 'Hello' }, method: 'POST' })

    expect(sentInit().body).toBe(JSON.stringify({ title: 'Hello' }))
    expect((sentInit().headers as Record<string, string>)['Content-Type']).toBe('application/json')

    vi.unstubAllGlobals()
    vi.stubGlobal('fetch', respond(200, {}))
    await request('topics', { method: 'GET' })

    expect(sentInit().body).toBeUndefined()
    expect((sentInit().headers as Record<string, string>)['Content-Type']).toBeUndefined()
  })

  // response.json() throws on an empty body, which would turn a successful
  // logout or delete into a failure.
  it('does not try to parse a 204', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- the absent value is the case under test
    vi.stubGlobal('fetch', respond(204, undefined))

    await expect(request('auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('does not try to parse a body that is not JSON', async () => {
    vi.stubGlobal('fetch', respond(200, '<html>', { json: false }))

    await expect(request('topics', { method: 'GET' })).resolves.toBeUndefined()
  })

  // Returning a refusal as though it had succeeded is how a caller runs its
  // success path over an error the server took care to explain.
  it('throws the server’s refusal rather than returning it', async () => {
    vi.stubGlobal('fetch', respond(403, { code: 'FORBIDDEN', message: 'Not allowed.' }))

    await expect(request('topics', { method: 'POST' })).rejects.toMatchObject({
      message: 'Not allowed.'
    })
  })

  it('throws on a 5xx as well', async () => {
    vi.stubGlobal('fetch', respond(500, { message: 'Something broke.' }))

    await expect(request('topics', { method: 'GET' })).rejects.toMatchObject({
      message: 'Something broke.'
    })
  })

  it('lets a caller add headers of its own', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await request('topics', { headers: { 'X-Test': 'yes' }, method: 'GET' })

    expect((sentInit().headers as Record<string, string>)['X-Test']).toBe('yes')
  })
})

describe('wpApi()', () => {
  it('talks to the core REST root rather than the plugin’s', async () => {
    vi.stubGlobal('fetch', respond(200, [{ id: 1 }]))

    await wpApi('comments', { method: 'GET' })

    expect(sentUrl()).toBe('https://example.test/wp-json/wp/v2/comments')
  })

  // Core answers a bare array or object; the portal's callers all read `.data`.
  it('wraps what core answers in the envelope the callers read', async () => {
    vi.stubGlobal('fetch', respond(200, [{ id: 1 }]))

    await expect(wpApi('comments', { method: 'GET' })).resolves.toEqual({ data: [{ id: 1 }] })
  })

  // A field left undefined would be dropped by JSON.stringify entirely, and
  // core reads a missing field as "leave it alone" rather than as "clear it".
  it('sends an undefined field as null so core actually clears it', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await wpApi('comments/1', { body: { content: 'x', parent: undefined }, method: 'PUT' })

    // eslint-disable-next-line unicorn/no-null -- null on the wire is the point of the test
    expect(sentInit().body).toBe(JSON.stringify({ content: 'x', parent: null }))
  })

  it('sends a JSON content type on deletes too, unlike the plugin’s own client', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await wpApi('comments/1', { method: 'DELETE' })

    expect((sentInit().headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('throws core’s error object as-is so its message survives', async () => {
    vi.stubGlobal('fetch', respond(400, { code: 'rest_comment_invalid_id', message: 'Invalid.' }))

    await expect(wpApi('comments/1', { method: 'GET' })).rejects.toMatchObject({
      code: 'rest_comment_invalid_id',
      message: 'Invalid.'
    })
  })

  it('falls back to the status text when a failure carries no body', async () => {
    vi.stubGlobal('fetch', respond(500, undefined, { json: false }))

    await expect(wpApi('comments', { method: 'GET' })).rejects.toMatchObject({ message: 'Error' })
  })
})

// A REST nonce is bound to whoever was logged in when the page rendered — often
// the anonymous visitor. After signing in, that nonce fails the cookie check
// with a 403, so the fresh one from the auth response replaces it.
describe('the nonce', () => {
  it('starts as the one injected into the page', () => {
    expect(getNonce()).toBe('page-nonce')
  })

  it('is replaced by the one an auth response hands back', () => {
    setNonce('nonce-after-login')

    expect(getNonce()).toBe('nonce-after-login')
  })

  it('is left alone by a response that carries no nonce', () => {
    setNonce('nonce-after-login')
    setNonce(undefined)
    setNonce('')

    expect(getNonce()).toBe('nonce-after-login')
  })

  it('is what the next request sends', async () => {
    setNonce('nonce-after-login')
    vi.stubGlobal('fetch', respond(200, {}))

    await request('topics', { method: 'GET' })

    expect((sentInit().headers as Record<string, string>)['X-WP-Nonce']).toBe('nonce-after-login')
  })
})
