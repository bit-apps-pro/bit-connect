import { request } from './request'
import { type QueryParam, type ResponseType } from './types'

export default async function get<RESPONSE_DATA>(
  uri: string,
  options?: Omit<Partial<RequestInit>, 'body'> & {
    headers?: Record<string, string>
    queryParam?: QueryParam
  }
): Promise<ResponseType<RESPONSE_DATA>> {
  try {
    return request(uri, {
      method: 'GET',
      ...options
    })
  } catch (error) {
    throw { errors: error }
  }
}
