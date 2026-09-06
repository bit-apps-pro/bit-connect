import config from '@config/config'

import { getNonce } from './nonce'
import { type QueryParam, type ResponseType } from './types'

// eslint-disable-next-line unicorn/no-null
const replaceUndefined = (_: string, value: unknown) => (value === undefined ? null : value)

/**
 * WordPress REST API utility for client-side
 * Makes requests to WordPress REST API endpoints (wp/v2/*)
 */
export async function wpApi<PAYLOAD, RESPONSE_DATA>(
  uri: string,
  options?: Omit<Partial<RequestInit>, 'body'> & {
    body?: PAYLOAD
    headers?: Record<string, string>
    method: string
    queryParam?: QueryParam
  }
): Promise<ResponseType<RESPONSE_DATA>> {
  const { body, headers, method, queryParam, ...rest } = options || {}
  const url = new URL(`${config.WP_REST_URL.replace(/\/$/, '')}${uri.startsWith('/') ? uri : `/${uri}`}`)

  if (queryParam) {
    for (const key in queryParam) {
      if (key) {
        url.searchParams.append(key, queryParam[key as keyof QueryParam].toString())
      }
    }
  }

  const response = await fetch(url, {
    body: body ? JSON.stringify(body, replaceUndefined) : undefined,
    credentials: 'include',
    headers: {
      ...(['DELETE', 'POST', 'PUT'].includes(method || 'GET')
        ? { 'Content-Type': 'application/json' }
        : {}),
      Accept: 'application/json',
      'X-WP-Nonce': getNonce(),
      ...headers
    },
    method,
    ...rest
  })

  // 204 / empty / non-JSON bodies must not be parsed.
  const responseData =
    response.status === 204 || !response.headers.get('content-type')?.includes('json')
      ? undefined
      : await response.json()

  // Throw the WordPress error object as-is so downstream extractErrorMessage()
  // can read its { code, message, data } shape. Re-wrapping it in { errors }
  // hid the real payload and rendered "[object Object]".
  if (!response.ok) {
    throw responseData ?? { message: response.statusText }
  }

  return { data: responseData } as ResponseType<RESPONSE_DATA>
}
