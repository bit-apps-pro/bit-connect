import { request } from './request'
import { type QueryParam, type ResponseType } from './types'

export default async function post<PAYLOAD, RESPONSE_DATA>(
  uri: string,
  options?: Omit<Partial<RequestInit>, 'body'> & {
    body?: Partial<BodyInit> | PAYLOAD
    headers?: Record<string, string>
    queryParam?: QueryParam
  }
): Promise<ResponseType<RESPONSE_DATA>> {
  return request(uri, {
    method: 'POST',
    ...options
  })
}
