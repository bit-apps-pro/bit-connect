import config from '@config/config'

import { type QueryParam, type ResponseType } from './types'

// eslint-disable-next-line unicorn/no-null
const replaceUndefined = (_: string, value: unknown) => (value === undefined ? null : value)

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
  try {
    const response = await fetch(url, {
      body: body ? JSON.stringify(body, replaceUndefined) : undefined,
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

    if (!response.ok) {
      throw responseData
    }

    return responseData as ResponseType<RESPONSE_DATA>
  } catch (error) {
    throw { errors: error }
  }
}
