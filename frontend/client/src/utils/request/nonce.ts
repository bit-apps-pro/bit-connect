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
