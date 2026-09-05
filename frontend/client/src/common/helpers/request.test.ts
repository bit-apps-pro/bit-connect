/* eslint-disable translate-obj-prop/translate-obj-prop -- fixtures are wire data, not user-facing copy */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import queryRequest, { extractUploadError, proxyRequest, request, uploadRequest } from './request'

vi.mock('@config/config', () => ({
  default: { API_URL: 'https://example.test/wp-json/bit-connect/v1' }
}))

vi.mock('../../config/config', () => ({
  default: { API_URL: 'https://example.test/wp-json/bit-connect/v1' }
}))

vi.mock('@utils/request/nonce', () => ({ getNonce: () => 'test-nonce' }))

const respond = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({
    json: () => Promise.resolve(body),
    ok: status >= 200 && status < 300,
    status
  })

const sentUrl = () =>
  String((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0])

const sentInit = () =>
  (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as {
    body?: unknown
    headers: Record<string, string>
    method: string
  }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('queryRequest', () => {
  it('returns the envelope of a successful response', async () => {
    vi.stubGlobal('fetch', respond(200, { code: 'SUCCESS', data: { id: 9 }, status: 'success' }))

    await expect(queryRequest('topics/9', {}, undefined, 'GET')).resolves.toEqual({
      code: 'SUCCESS',
      data: { id: 9 },
      status: 'success'
    })
  })

  it('appends the query parameters it was given', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await queryRequest('topics', {}, { page: 2, stage: 'ideas' }, 'GET')

    expect(sentUrl()).toContain('page=2')
    expect(sentUrl()).toContain('stage=ideas')
  })

  it('sends the nonce on every request', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await queryRequest('topics', {}, undefined, 'GET')

    expect(sentInit().headers['X-WP-Nonce']).toBe('test-nonce')
  })

  it('sends a JSON body on a post', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await queryRequest('topics', { title: 'Hello' }, undefined, 'POST')

    expect(sentInit().body).toBe(JSON.stringify({ title: 'Hello' }))
    expect(sentInit().headers['Content-Type']).toBe('application/json')
  })

  // A field left undefined would be dropped by JSON.stringify entirely, and the
  // server reads a missing field as "leave it alone" rather than as "clear it".
  it('sends an undefined field as null so the server actually clears it', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    await queryRequest('topics/9', { excerpt: undefined, title: 'Hello' }, undefined, 'POST')

    // eslint-disable-next-line unicorn/no-null -- null on the wire is the point of the test
    expect(sentInit().body).toBe(JSON.stringify({ excerpt: null, title: 'Hello' }))
  })

  // The browser sets its own multipart boundary; a Content-Type we set would
  // override it and the server would fail to parse the upload.
  it('leaves the content type to the browser for a form upload', async () => {
    vi.stubGlobal('fetch', respond(200, {}))

    const body = new FormData()
    body.append('file', new File(['x'], 'a.png'))

    await queryRequest('users/7/avatar', body, undefined, 'POST')

    expect(sentInit().headers['Content-Type']).toBeUndefined()
    expect(sentInit().body).toBe(body)
  })

  it('throws the server’s refusal rather than returning it', async () => {
    vi.stubGlobal('fetch', respond(403, { code: 'ERROR', data: 'Not allowed.', status: 'error' }))

    await expect(queryRequest('topics', {}, undefined, 'POST')).rejects.toMatchObject({
      data: 'Not allowed.'
    })
  })

  // Callers all read `.data` for the reason, so a network failure has to arrive
  // wearing the same envelope as one the server sent.
  it('wraps a transport failure in the same envelope the server uses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')))

    await expect(queryRequest('topics', {}, undefined, 'GET')).rejects.toEqual({
      code: 'ERROR',
      data: 'Network down',
      status: 'error'
    })
  })
})

// The non-throwing sibling: callers that render the failure inline rather than
// catching it read the same envelope either way.
describe('request', () => {
  it('resolves with the refusal instead of throwing it', async () => {
    vi.stubGlobal('fetch', respond(403, { code: 'ERROR', data: 'Not allowed.', status: 'error' }))

    await expect(request('topics', {}, undefined, 'POST')).resolves.toMatchObject({
      data: 'Not allowed.'
    })
  })

  it('resolves with a transport failure too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')))

    await expect(request('topics', {}, undefined, 'GET')).resolves.toEqual({
      code: 'ERROR',
      data: 'Network down',
      status: 'error'
    })
  })
})

describe('proxyRequest', () => {
  it('posts the endpoint description to the proxy route', async () => {
    vi.stubGlobal('fetch', respond(200, { code: 'SUCCESS', data: {}, status: 'success' }))

    await proxyRequest({ method: 'GET', url: 'https://api.example.com/x' })

    expect(sentUrl()).toContain('/proxy/route')
    expect(sentInit().method).toBe('POST')
  })
})

/**
 * A stand-in for XMLHttpRequest that a test drives by hand.
 *
 * fetch cannot observe how much of a request body has been sent — progress
 * events only exist on XHR — which is the whole reason uploadRequest exists,
 * and the reason it cannot be tested through the fetch stub above.
 */
class FakeXhr {
  static last: FakeXhr

  public aborted = false

  public responseText = ''

  public sent: unknown

  public status = 200

  private uploadHandlers: Record<string, (event: unknown) => void> = {}

  public upload = {
    addEventListener: (name: string, handler: (event: unknown) => void) => {
      this.uploadHandlers[name] = handler
    }
  }

  public url = ''

  public withCredentials = false

  private handlers: Record<string, () => void> = {}

  private headers: Record<string, string> = {}

  constructor() {
    FakeXhr.last = this
  }

  abort() {
    this.aborted = true

    // A browser fires no abort event for a request that was never sent, and
    // uploadRequest aborts before send() when the signal is already aborted.
    if (this.sent !== undefined) this.handlers.abort?.()
  }

  addEventListener(name: string, handler: () => void) {
    this.handlers[name] = handler
  }

  fail(event: 'error' | 'timeout') {
    this.handlers[event]?.()
  }

  /** Simulates the response arriving. */
  finish(status: number, body: string) {
    this.status = status
    this.responseText = body
    this.handlers.load?.()
  }

  headerFor(name: string) {
    return this.headers[name]
  }

  open(_method: string, url: string) {
    this.url = url
  }

  /** Simulates the browser reporting progress. */
  progress(loaded: number, total: number, lengthComputable = true) {
    this.uploadHandlers.progress?.({ lengthComputable, loaded, total })
  }

  send(body: unknown) {
    this.sent = body
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }
}

/** A one-file form, the shape every upload here sends. */
function body(): FormData {
  const form = new FormData()
  form.append('file', new File(['x'], 'a.png'))

  return form
}

describe('uploadRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
  })

  it('posts the form with the nonce and the session cookie', async () => {
    const pending = uploadRequest('users/7/avatar', body())

    FakeXhr.last.finish(200, JSON.stringify({ code: 'SUCCESS', data: {}, status: 'success' }))
    await pending

    expect(FakeXhr.last.url).toContain('/users/7/avatar')
    expect(FakeXhr.last.headerFor('X-WP-Nonce')).toBe('test-nonce')
    expect(FakeXhr.last.withCredentials).toBe(true)
  })

  it('reports progress as a percentage', async () => {
    const seen: number[] = []
    const pending = uploadRequest('users/7/avatar', body(), { onProgress: p => seen.push(p) })

    FakeXhr.last.progress(50, 200)
    FakeXhr.last.progress(150, 200)
    FakeXhr.last.finish(200, JSON.stringify({ data: {} }))
    await pending

    expect(seen.slice(0, 2)).toEqual([25, 75])
  })

  // Small files often skip the final tick, and a bar stuck at 80% on a finished
  // upload reads as a stall.
  it('always reports completion, even when no tick reached the end', async () => {
    const seen: number[] = []
    const pending = uploadRequest('users/7/avatar', body(), { onProgress: p => seen.push(p) })

    FakeXhr.last.finish(200, JSON.stringify({ data: {} }))
    await pending

    expect(seen.at(-1)).toBe(100)
  })

  it('ignores a tick the browser cannot measure', async () => {
    const seen: number[] = []
    const pending = uploadRequest('users/7/avatar', body(), { onProgress: p => seen.push(p) })

    FakeXhr.last.progress(50, 0, false)
    FakeXhr.last.finish(200, JSON.stringify({ data: {} }))
    await pending

    expect(seen).toEqual([100])
  })

  it('rejects with the server’s reason on a refusal', async () => {
    const pending = uploadRequest('users/7/avatar', body())

    FakeXhr.last.finish(
      400,
      JSON.stringify({
        code: 'ERROR',
        data: 'Files with the .svg extension are not allowed.',
        status: 'error'
      })
    )

    await expect(pending).rejects.toMatchObject({
      data: 'Files with the .svg extension are not allowed.'
    })
  })

  // A PHP fatal or an HTML error page is not JSON, and parsing it would throw
  // somewhere the caller cannot read.
  it('rejects readably when the answer is not JSON at all', async () => {
    const pending = uploadRequest('users/7/avatar', body())

    FakeXhr.last.finish(200, '<html>Fatal error</html>')

    await expect(pending).rejects.toEqual({
      code: 'ERROR',
      data: 'Unexpected response from the server.',
      status: 'error'
    })
  })

  it('reports a network failure in the same envelope', async () => {
    const pending = uploadRequest('users/7/avatar', body())

    FakeXhr.last.fail('error')

    await expect(pending).rejects.toMatchObject({ data: 'Network error while uploading.' })
  })

  it('reports a timeout in the same envelope', async () => {
    const pending = uploadRequest('users/7/avatar', body())

    FakeXhr.last.fail('timeout')

    await expect(pending).rejects.toMatchObject({ data: 'The upload timed out.' })
  })

  it('cancels when the caller aborts', async () => {
    const controller = new AbortController()
    const pending = uploadRequest('users/7/avatar', body(), { signal: controller.signal })

    controller.abort()

    await expect(pending).rejects.toMatchObject({ data: 'Upload cancelled.' })
  })

  // Nothing leaves the browser for an upload the caller cancelled before it
  // started — which matters most on a page that aborts in-flight uploads when
  // it unmounts.
  it('never starts when the signal is already aborted', () => {
    const controller = new AbortController()
    controller.abort()

    void uploadRequest('users/7/avatar', body(), { signal: controller.signal }).catch(() => {
      /* the rejection is the point */
    })

    expect(FakeXhr.last.aborted).toBe(true)
    expect(FakeXhr.last.sent).toBeUndefined()
  })
})

// Prefer the server's wording so the member is told why something was rejected,
// rather than a generic "Upload failed" over a message that named the reason.
describe('extractUploadError', () => {
  it('prefers the reason the server wrote', () => {
    expect(
      extractUploadError({ code: 'ERROR', data: 'Files with the .svg extension are not allowed.' })
    ).toBe('Files with the .svg extension are not allowed.')
  })

  it('falls back to a transport error’s own message', () => {
    expect(extractUploadError(new Error('Network error while uploading.'))).toBe(
      'Network error while uploading.'
    )
  })

  it('ignores a data field that carries no words', () => {
    expect(extractUploadError({ data: '   ' })).toBe('Upload failed')
    expect(extractUploadError({ data: { nested: true } })).toBe('Upload failed')
  })

  it('still says something for a shape it does not recognise', () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- the absent value is the case under test
    expect(extractUploadError(undefined)).toBe('Upload failed')
    expect(extractUploadError('a bare string')).toBe('Upload failed')
  })
})
