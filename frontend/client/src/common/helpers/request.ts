import { getNonce } from '@utils/request/nonce'

import config from '../../config/config'

export type MethodType = 'GET' | 'POST'

export type QueryParam = Record<string, number | string>

export interface Response<T> {
  code: 'ERROR' | 'SUCCESS' | 'VALIDATION' | 'WARNING'
  data: T
  status: 'error' | 'success'
}

export interface EndpointType {
  bodyParams?: Record<string, MaybeArrayEndPointValueType>
  headers?: Record<string, MaybeArrayEndPointValueType>
  method: MethodType
  queryParams?: Record<string, MaybeArrayEndPointValueType>
  url: string
}

interface EncryptionValueType {
  encryption:
    | 'base64_decode'
    | 'base64_encode'
    | 'base64_urlencode'
    | 'hmac_decrypt'
    | 'hmac_encrypt'
    | 'sha256'
  value: MaybeArrayEndPointValueType
}

type EndPointValueType = EncryptionValueType | number | Record<string, unknown> | string
type MaybeArrayEndPointValueType = EndPointValueType | EndPointValueType[]

interface RequestOptions {
  body?: FormData | string
  headers?: Record<string, string>
  method?: MethodType
  signal?: AbortSignal
}

// Helpers

const replaceUndefined = (_: string, value: unknown) =>
  // eslint-disable-next-line unicorn/no-null
  value === undefined ? null : value

const createUrl = (action: string, queryParams?: QueryParam): URL => {
  const { API_URL } = config
  const uri = new URL(`${API_URL}/${action}`)
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      uri.searchParams.append(key, value.toString())
    })
  }

  return uri
}

const createRequestOptions = (
  method: MethodType,
  data?: unknown,
  options?: RequestOptions
): RequestOptions => {
  const fetchOptions: RequestOptions = {
    method,
    ...options
  }

  if (method.toLowerCase() === 'post' && data) {
    fetchOptions.body = data instanceof FormData ? data : JSON.stringify(data, replaceUndefined)
  }

  if (!fetchOptions.headers) {
    fetchOptions.headers = {}
  }

  if (!(data instanceof FormData)) {
    fetchOptions.headers['Content-Type'] = 'application/json'
  }
  fetchOptions.headers['X-WP-Nonce'] = getNonce()

  return fetchOptions
}

// Main request functions
export default async function queryRequest<T>(
  action: string,
  data?: unknown,
  queryParam?: QueryParam,
  method: MethodType = 'POST',
  options?: RequestOptions
): Promise<Response<T>> {
  const uri = createUrl(action, queryParam)
  const fetchOptions = createRequestOptions(method, data, options)
  try {
    const response = await fetch(uri, fetchOptions)
    const responseData = await response.json()

    if (!response.ok) {
      throw responseData
    }

    return responseData as Response<T>
  } catch (error) {
    if (error instanceof Error) {
      throw {
        code: 'ERROR',
        data: error.message,
        status: 'error'
      } as Response<T>
    }
    throw error
  }
}

export async function request<T>(
  action: string,
  data?: unknown,
  queryParam?: QueryParam,
  method: MethodType = 'POST',
  options?: RequestOptions
): Promise<Response<T>> {
  return queryRequest<T>(action, data, queryParam, method, options).catch(error => error as Response<T>)
}

export async function proxyRequest<T>(data: EndpointType): Promise<Response<T>> {
  return queryRequest<T>('proxy/route', data).catch(error => error as Response<T>)
}

/** Same envelope the REST API returns, so callers handle failures uniformly. */
const transportFailure = <T>(message: string): Response<T> =>
  ({ code: 'ERROR', data: message, status: 'error' }) as Response<T>

export interface UploadOptions {
  /** Receives 0–100 as the request body is sent. Only fires when the browser can measure the total. */
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/**
 * POST a FormData payload and report upload progress.
 *
 * `queryRequest` uses fetch, which cannot observe how much of a request body
 * has been sent — progress events only exist on XMLHttpRequest. This mirrors
 * queryRequest's URL building, nonce header and error shape so callers can swap
 * between them without special-casing failures.
 */
export function uploadRequest<T>(
  action: string,
  formData: FormData,
  { onProgress, signal }: UploadOptions = {}
): Promise<Response<T>> {
  return new Promise<Response<T>>((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.open('POST', createUrl(action).toString())
    xhr.setRequestHeader('X-WP-Nonce', getNonce())
    // Cookie auth: WordPress validates the nonce against the logged-in session.
    xhr.withCredentials = true

    if (onProgress) {
      xhr.upload.addEventListener('progress', event => {
        if (!event.lengthComputable) return
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      })
    }

    xhr.addEventListener('load', () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(xhr.responseText)
      } catch {
        reject(transportFailure<T>('Unexpected response from the server.'))
        return
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(parsed)
        return
      }

      // The bytes are on the server; report completion even if no progress
      // event reached 100 (small files often skip the final tick).
      onProgress?.(100)
      resolve(parsed as Response<T>)
    })

    xhr.addEventListener('error', () => reject(transportFailure<T>('Network error while uploading.')))
    xhr.addEventListener('timeout', () => reject(transportFailure<T>('The upload timed out.')))
    xhr.addEventListener('abort', () => reject(transportFailure<T>('Upload cancelled.')))

    if (signal) {
      if (signal.aborted) {
        xhr.abort()
        return
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }

    xhr.send(formData)
  })
}

/**
 * Reads the human-readable reason out of a failed request.
 *
 * Rejections arrive either as the server's `{ status, code, data }` body — where
 * `data` carries the reason, e.g. "Files with the .svg extension are not
 * allowed." — or as an Error for transport failures. Prefer the server's
 * wording so the user is told why something was rejected.
 */
export function extractUploadError(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const { data } = error as { data?: unknown }
    if (typeof data === 'string' && data.trim()) return data
  }
  if (error instanceof Error) return error.message
  return 'Upload failed'
}
