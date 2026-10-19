import { portalUrl } from '@utils/auth-urls'
import { routePath } from '@utils/route-path'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import config from '@/config/config'

/**
 * Leaves the login or signup page for `redirectTo` once the visitor is signed in.
 *
 * A visitor who arrived signed in is moved inside the app. One who signed in
 * on this page gets a full page load instead: everything the server put in
 * the page — `config.IS_LOGGED_IN`, the unread count, the preloaded answers,
 * the REST nonce — still describes a guest, and the notification queries are
 * gated on it, so without a reload the bell stays empty until the next one.
 */
export default function useLeaveWhenSignedIn(isLoggedIn: boolean, redirectTo: string): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoggedIn) return

    if (config.IS_LOGGED_IN) {
      navigate(redirectTo, { replace: true })
    } else {
      window.location.replace(portalUrl(routePath(redirectTo)))
    }
  }, [isLoggedIn, navigate, redirectTo])
}
