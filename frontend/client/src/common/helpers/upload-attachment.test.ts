import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as RequestModule from './request'

import uploadAttachment, { CHUNK_BYTES, MAX_RETRIES } from './upload-attachment'

type RequestModule = typeof RequestModule

const { request, uploadRequest } = vi.hoisted(() => ({
  request: vi.fn(),
  uploadRequest: vi.fn()
}))

vi.mock('./request', async importOriginal => {
  const actual = await importOriginal<RequestModule>()
  return { ...actual, request, uploadRequest }
})

vi.mock('../../config/config', () => ({
  default: {
    API_URL: 'https://example.test/wp-json/bit-connect/v1',
    POSTING_LIMITS: { maxFileSizeByKind: { document: 64 * 1024 * 1024, image: 64 * 1024 * 1024, video: 64 * 1024 * 1024 } }
  }
}))

const fileOf = (bytes: number, name = 'clip.mp4') => new File([new Uint8Array(bytes)], name, { type: 'video/mp4' })

/** What each call to the chunk endpoint was sent. */
const sentPieces = () =>
  uploadRequest.mock.calls.map(call => {
    const [action, form] = call as [string, FormData]
    return {
      action,
      bytes: (form.get('chunk') as Blob | null)?.size,
      offset: form.get('offset'),
      uploadId: form.get('upload_id')
    }
  })

const receipt = (received: number) => ({ code: 'SUCCESS', data: { received }, status: 'success' })
const attachment = { code: 'SUCCESS', data: { id: 9, url: 'https://e.test/clip.mp4' }, status: 'success' }

/** A failure that says the connection dropped, as uploadRequest marks it. */
const dropped = () => {
  const failure = { code: 'ERROR', data: 'The connection dropped while uploading.', status: 'error' }
  Object.defineProperty(failure, 'retryable', { enumerable: false, value: true })
  return failure
}

beforeEach(() => {
  vi.useFakeTimers()
  request.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('uploadAttachment', () => {
  it('sends a file that fits in one piece as one ordinary upload', async () => {
    uploadRequest.mockResolvedValueOnce(attachment)

    await expect(uploadAttachment(fileOf(1000))).resolves.toBe(attachment)
    expect(uploadRequest).toHaveBeenCalledTimes(1)
    expect(uploadRequest.mock.calls[0][0]).toBe('attachments')
  })

  it('sends a large file in pieces, carrying on from each receipt', async () => {
    const size = CHUNK_BYTES * 2 + 10
    uploadRequest
      .mockResolvedValueOnce(receipt(CHUNK_BYTES))
      .mockResolvedValueOnce(receipt(CHUNK_BYTES * 2))
      .mockResolvedValueOnce(attachment)

    await expect(uploadAttachment(fileOf(size))).resolves.toBe(attachment)

    const pieces = sentPieces()
    expect(pieces.map(piece => [piece.action, piece.offset, piece.bytes])).toEqual([
      ['attachments/chunk', '0', CHUNK_BYTES],
      ['attachments/chunk', String(CHUNK_BYTES), CHUNK_BYTES],
      ['attachments/chunk', String(CHUNK_BYTES * 2), 10]
    ])
    // One upload, one id, and it is the kind the server accepts.
    expect(new Set(pieces.map(piece => piece.uploadId)).size).toBe(1)
    expect(pieces[0].uploadId).toMatch(/^[a-f0-9]{32}$/)
  })

  it('sends a piece again after the connection drops, after a pause', async () => {
    uploadRequest.mockRejectedValueOnce(dropped()).mockResolvedValueOnce(receipt(CHUNK_BYTES)).mockResolvedValueOnce(attachment)

    const pending = uploadAttachment(fileOf(CHUNK_BYTES + 1))
    await vi.advanceTimersByTimeAsync(1000)

    await expect(pending).resolves.toBe(attachment)
    expect(sentPieces().map(piece => piece.offset)).toEqual(['0', '0', String(CHUNK_BYTES)])
  })

  it('goes back to where the server is when a piece went missing', async () => {
    uploadRequest
      .mockResolvedValueOnce(receipt(CHUNK_BYTES))
      // The server lost the second piece and says it still has only the first.
      .mockResolvedValueOnce(receipt(CHUNK_BYTES))
      .mockResolvedValueOnce(receipt(CHUNK_BYTES * 2))
      .mockResolvedValueOnce(attachment)

    await expect(uploadAttachment(fileOf(CHUNK_BYTES * 2 + 1))).resolves.toBe(attachment)
    expect(sentPieces().map(piece => piece.offset)).toEqual([
      '0',
      String(CHUNK_BYTES),
      String(CHUNK_BYTES),
      String(CHUNK_BYTES * 2)
    ])
  })

  it('does not send a refused piece again, and throws the server’s reason away with the upload', async () => {
    const refusal = { code: 'ERROR', data: 'File type .exe is not allowed.', status: 'error' }
    uploadRequest.mockRejectedValueOnce(refusal)

    await expect(uploadAttachment(fileOf(CHUNK_BYTES + 1))).rejects.toBe(refusal)
    expect(uploadRequest).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('attachments/chunk/abort', { upload_id: sentPieces()[0].uploadId })
  })

  it('gives up after a few retries of the same piece', async () => {
    uploadRequest.mockRejectedValue(dropped())

    const pending = uploadAttachment(fileOf(CHUNK_BYTES + 1)).catch(error_ => error_)
    await vi.runAllTimersAsync()

    expect(await pending).toMatchObject({ data: 'The connection dropped while uploading.' })
    expect(uploadRequest).toHaveBeenCalledTimes(MAX_RETRIES + 1)
    expect(request).toHaveBeenCalledWith('attachments/chunk/abort', expect.anything())
  })

  it('stops and discards the upload when it is cancelled', async () => {
    const controller = new AbortController()
    uploadRequest.mockImplementationOnce(async () => {
      controller.abort()
      throw { code: 'ERROR', data: 'Upload cancelled.', status: 'error' }
    })

    await expect(uploadAttachment(fileOf(CHUNK_BYTES + 1), { signal: controller.signal })).rejects.toMatchObject({
      data: 'Upload cancelled.'
    })
    expect(uploadRequest).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('attachments/chunk/abort', expect.anything())
  })

  it('reports progress over the whole file, not each piece', async () => {
    const seen: number[] = []
    uploadRequest
      .mockImplementationOnce(async (_action: string, _form: FormData, { onProgress }) => {
        onProgress(100)
        return receipt(CHUNK_BYTES)
      })
      .mockImplementationOnce(async (_action: string, _form: FormData, { onProgress }) => {
        onProgress(100)
        return attachment
      })

    await uploadAttachment(fileOf(CHUNK_BYTES * 2), { onProgress: percent => seen.push(percent) })

    expect(seen).toEqual([50, 100])
  })
})
