import config from '../../config/config'
import { isRetryableFailure, request, type Response, type UploadOptions, uploadRequest } from './request'

/**
 * The size of each piece a large file is sent in.
 *
 * Small enough that one piece crosses a slow connection well inside the minute
 * or two a proxy allows a request, and that losing one costs little; large
 * enough that a video is not hundreds of requests.
 */
export const CHUNK_BYTES = 4 * 1024 * 1024

/** How many times one piece is sent again before the upload gives up. */
export const MAX_RETRIES = 4

/** The wait before the first retry; it doubles with each one after. */
const FIRST_RETRY_DELAY_MS = 1000

/**
 * The largest piece the server will take in one request. The posting limits
 * the page carries never exceed what PHP accepts, so the largest of them is a
 * size one request is known to get through.
 */
const chunkBytes = () => {
  const sizes = Object.values(config.POSTING_LIMITS?.maxFileSizeByKind ?? {}).filter(size => size > 0)
  return sizes.length > 0 ? Math.min(CHUNK_BYTES, Math.max(...sizes)) : CHUNK_BYTES
}

const randomId = () =>
  [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('')

const cancelled = <T>() => ({ code: 'ERROR', data: 'Upload cancelled.', status: 'error' }) as Response<T>

/** Waits, unless the upload is cancelled first. */
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(cancelled())
      },
      { once: true }
    )
  })

/** What the server says after a piece that was not the last. */
interface ChunkReceipt {
  received: number
}

const isReceipt = (data: unknown): data is ChunkReceipt =>
  Boolean(data && typeof data === 'object' && 'received' in data && !('id' in data))

/**
 * Upload a file a member attached or placed in a post.
 *
 * A file that fits in one piece goes up in one request, as before. A larger
 * one is sent in pieces (ChunkedUpload.php): each is a short request, a piece
 * that fails because the connection dropped or a proxy gave up is sent again
 * after a pause, and the server's receipt says where to carry on. A refusal —
 * the wrong type, too large — is not retried; it would only be refused again.
 *
 * Progress covers the whole file. Cancelling stops the piece in flight and
 * tells the server to throw away what it has.
 */
export default async function uploadAttachment<T>(
  file: File,
  { onProgress, signal }: UploadOptions = {}
): Promise<Response<T>> {
  const size = chunkBytes()

  if (file.size <= size) {
    const form = new FormData()
    form.append('file', file)
    return uploadRequest<T>('attachments', form, { onProgress, signal })
  }

  const uploadId = randomId()
  const discard = () => {
    // Fire and forget: the member has moved on, and the daily cleanup clears
    // anything this does not reach.
    void request('attachments/chunk/abort', { upload_id: uploadId })
  }

  let offset = 0
  let failures = 0

  for (;;) {
    if (signal?.aborted) {
      discard()
      throw cancelled<T>()
    }

    const piece = file.slice(offset, offset + size)
    const form = new FormData()
    form.append('upload_id', uploadId)
    form.append('offset', String(offset))
    form.append('size', String(file.size))
    form.append('name', file.name)
    form.append('chunk', piece, file.name)

    const start = offset
    try {
      const response = await uploadRequest<ChunkReceipt | T>('attachments/chunk', form, {
        onProgress: percent => {
          const sent = start + (piece.size * percent) / 100
          onProgress?.(Math.min(100, Math.round((sent / file.size) * 100)))
        },
        signal
      })

      if (!isReceipt(response.data)) return response as Response<T>

      // A receipt that does not move the upload forward means a piece went
      // missing on the way — sent again from where the server is. One that
      // keeps not moving it is a server that cannot keep the pieces.
      if (response.data.received > start) {
        failures = 0
      } else if (++failures > MAX_RETRIES) {
        discard()
        throw { code: 'ERROR', data: 'The upload could not be completed. Try again.', status: 'error' } as Response<T>
      }

      offset = response.data.received
    } catch (error) {
      if (signal?.aborted) {
        discard()
        throw cancelled<T>()
      }

      failures += 1
      if (!isRetryableFailure(error) || failures > MAX_RETRIES) {
        discard()
        throw error
      }

      await wait(FIRST_RETRY_DELAY_MS * 2 ** (failures - 1), signal).catch((error_: unknown) => {
        discard()
        throw error_
      })
    }
  }
}
