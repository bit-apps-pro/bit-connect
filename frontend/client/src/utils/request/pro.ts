import config from '@config/config'

import { request } from './request'
import { type QueryParam, type ResponseType } from './types'

/**
 * A call to a Bit Connect Pro route from the portal.
 *
 * Identical to request() apart from the namespace: pro registers its routes
 * under `bit-connect-pro/v1`, while API_URL names the free plugin's. Calling
 * request() for a pro route addresses the wrong namespace and gets a 404 that
 * reads like a broken endpoint rather than a wrong URL.
 *
 * It lives in the free tree, and has to: the overlay resolves free modules
 * through aliases, and a transport that only existed inside the overlay would
 * be unbuildable from here. Nothing free calls it — the only callers are pro
 * modules, which the free bundle does not contain — so on a free install this
 * is a function that is never reached, not a pro route the free plugin knows
 * how to ask for.
 */
export async function proRequest<PAYLOAD, RESPONSE_DATA>(
  uri: string,
  options?: Omit<Partial<RequestInit>, 'body'> & {
    body?: PAYLOAD
    headers?: Record<string, string>
    method?: string
    queryParam?: QueryParam
  }
): Promise<ResponseType<RESPONSE_DATA>> {
  return request<PAYLOAD, RESPONSE_DATA>(uri, {
    ...options,
    baseUrl: config.PRO_API_URL,
    method: options?.method || 'GET'
  })
}
