import config from '@config/config'

/**
 * WordPress REST nonces are bound to the current user. The nonce injected at
 * page render time is created for whoever was logged in then. After an auth
 * state change (login / signup / email verification) that nonce becomes invalid
 * and authenticated requests fail the cookie nonce check
 * (rest_cookie_invalid_nonce / "Cookie check failed", 403).
 *
 * We keep a mutable copy of the nonce here and refresh it from auth responses so
 * subsequent requests keep working without a full page reload.
 *
 * A guest's page carries no nonce (see BaseView::createConfigVariable): the
 * check only guards a login cookie, and an old one in a cached page made every
 * request fail. Login hands one over, so members still send it.
 */
let currentNonce = config.NONCE

export const getNonce = (): string => currentNonce

export const setNonce = (nonce: string | undefined): void => {
  if (nonce) currentNonce = nonce
}

/**
 * The nonce header, or none at all while there is no nonce. Not an empty
 * header: WordPress checks any `X-WP-Nonce` it gets, and an empty one fails.
 */
export const nonceHeader = (): Record<string, string> =>
  currentNonce ? { 'X-WP-Nonce': currentNonce } : {}

/** What WordPress answers a nonce that is no longer valid with. */
const INVALID_NONCE = 'rest_cookie_invalid_nonce'

/**
 * Whether a response is WordPress refusing the nonce, not the request. Reads a
 * copy, so the caller can still read the body.
 */
export async function isInvalidNonce(response: Response): Promise<boolean> {
  if (response.status !== 403) return false

  try {
    const body = (await response.clone().json()) as undefined | { code?: string }
    return body?.code === INVALID_NONCE
  } catch {
    return false
  }
}

let renewing: Promise<boolean> | undefined

/**
 * Asks WordPress for a new nonce, through core's own `rest-nonce` action.
 *
 * A nonce lives 12 to 24 hours. A tab left open longer, or a page a cache kept
 * for a signed-in member, holds one WordPress refuses, and every request from
 * it failed with "Cookie check failed" until a reload. Core answers with a new
 * nonce while the login cookie is valid, and with `0` once it is not — then
 * the member is signed out, and the request goes again as a guest's, with no
 * header. Requests that fail together share one renewal.
 *
 * @returns whether the request is worth sending again
 */
export function renewNonce(): Promise<boolean> {
  renewing ??= (async () => {
    if (!config.AJAX_URL) return false

    try {
      const url = new URL(config.AJAX_URL, window.location.href)
      url.searchParams.set('action', 'rest-nonce')

      const response = await fetch(url, { credentials: 'include' })
      const body = await response.text()
      const text = body.trim()

      currentNonce = response.ok && /^[\da-f]{10}$/i.test(text) ? text : ''
      return true
    } catch {
      return false
    } finally {
      renewing = undefined
    }
  })()

  return renewing
}

/**
 * Sends a request with the nonce header, and once more with a new nonce if
 * WordPress refused the first. `send` builds the request from the headers it
 * is given, so the second attempt carries the new nonce.
 */
export async function sendWithNonce(
  send: (headers: Record<string, string>) => Promise<Response>
): Promise<Response> {
  const response = await send(nonceHeader())

  if (!currentNonce || !(await isInvalidNonce(response)) || !(await renewNonce())) return response

  return send(nonceHeader())
}
