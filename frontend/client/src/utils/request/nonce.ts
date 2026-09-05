import config from '@config/config'

/**
 * WordPress REST nonces are bound to the current user. The nonce injected at
 * page render time is created for whoever was logged in then (often the
 * anonymous visitor). After an auth state change (login / signup / email
 * verification) that nonce becomes invalid and authenticated requests fail the
 * cookie nonce check (rest_cookie_invalid_nonce / "Cookie check failed", 403).
 *
 * We keep a mutable copy of the nonce here and refresh it from auth responses so
 * subsequent requests keep working without a full page reload.
 */
let currentNonce = config.NONCE

export const getNonce = (): string => currentNonce

export const setNonce = (nonce: string | undefined): void => {
  if (nonce) currentNonce = nonce
}
