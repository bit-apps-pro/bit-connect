import config from '@config/config'

import { getNonce } from './nonce'
import { type QueryParam, type ResponseType } from './types'

export async function request<PAYLOAD, RESPONSE_DATA>(
  uri: string,
  options?: Omit<Partial<RequestInit>, 'body'> & {
    body?: PAYLOAD
    headers?: Record<string, string>
    method: string
    queryParam?: QueryParam
  }
): Promise<ResponseType<RESPONSE_DATA>> {
  const { body, headers, method, queryParam, ...rest } = options || {}
  const url = new URL(`${config.API_URL.replace(/\/$/, '')}${uri.startsWith('/') ? uri : `/${uri}`}`)
  if (queryParam) {
    for (const key in queryParam) {
      if (key) {
        url.searchParams.append(key, queryParam[key as keyof QueryParam].toString())
      }
    }
  }
  const response = await fetch(url, {
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
    headers: {
      ...(['POST', 'PUT'].includes(method || 'GET') ? { 'Content-Type': 'application/json' } : {}),
      Accept: 'application/json',
      'X-WP-Nonce': getNonce(),
      ...headers
    },
    method: method,
    ...rest
  })

  // 204 (logout, deletes) and other empty/non-JSON bodies must not be parsed —
  // response.json() throws on an empty body and turns a success into a failure.
  const responseData =
    response.status === 204 || !response.headers.get('content-type')?.includes('json')
      ? undefined
      : await response.json()

  if (!response.ok) {
    console.error('API Error:', {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      url: url.toString()
    })
    throw responseData
  }

  return responseData as ResponseType<RESPONSE_DATA>
}
