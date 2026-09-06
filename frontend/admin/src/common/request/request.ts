import config from '@config/config'

import { type QueryParam, type ResponseType } from './types'

export async function request<PAYLOAD, RESPONSE_DATA>(
  uri: string,
  options?: Omit<Partial<RequestInit>, 'body'> & {
    /** Override the REST namespace. Defaults to the free plugin's. */
    baseUrl?: string
    body?: PAYLOAD
    headers?: Record<string, string>
    method: string
    queryParam?: QueryParam
  }
): Promise<ResponseType<RESPONSE_DATA>> {
  const { baseUrl, body, headers, method, queryParam, ...rest } = options || {}
  const base = (baseUrl || config.API_URL).replace(/\/$/, '')
  const url = new URL(`${base}${uri.startsWith('/') ? uri : `/${uri}`}`)
  if (queryParam) {
    for (const key in queryParam) {
      if (key) {
        url.searchParams.append(key, queryParam[key as keyof QueryParam].toString())
      }
    }
  }
  try {
    const response = await fetch(url, {
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      headers: {
        ...(['POST', 'PUT'].includes(method || 'GET') ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        'X-WP-Nonce': config.NONCE,
        ...headers
      },
      method: method,
      ...rest
    })
    const responseData = await response.json()

    // A refusal is not a result. Without this the body of a 4xx was returned as
    // though it had succeeded, so every caller ran its success path over it:
    // resolving a report that no longer existed told the moderator "Closed 0
    // report(s)" in a green toast and invalidated the queue, and the reason the
    // server had written was never shown to anyone.
    if (!response.ok) {
      throw responseData
    }

    return responseData as ResponseType<RESPONSE_DATA>
  } catch (error) {
    // Rethrow a refusal the server explained. Wrapping it as a transport error
    // would bury the message the caller is about to read.
    if (error && typeof error === 'object' && 'status' in error) {
      throw error
    }

    throw { errors: error }
  }
}

/**
 * A call to a Bit Connect Pro route.
 *
 * Identical to request() apart from the namespace: pro registers its routes
 * under `bit-connect-pro/v1`, while API_URL names the free plugin's. Calling
 * request() for a pro route addresses the wrong namespace and gets a 404 that
 * looks like a broken endpoint rather than a wrong URL.
 */
export async function proRequest<PAYLOAD, RESPONSE_DATA>(
  uri: string,
  options?: Omit<Partial<RequestInit>, 'body'> & {
    body?: PAYLOAD
    headers?: Record<string, string>
    method: string
    queryParam?: QueryParam
  }
): Promise<ResponseType<RESPONSE_DATA>> {
  return request<PAYLOAD, RESPONSE_DATA>(uri, {
    ...options,
    baseUrl: config.PRO_API_URL,
    method: options?.method || 'GET'
  })
}
