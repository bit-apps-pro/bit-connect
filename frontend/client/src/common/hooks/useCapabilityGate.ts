import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { useCallback, useContext } from 'react'

import useLoginWarningStore from '@/components/features/login-warning-modal/state/use-login-warning-store'
import { useAuthStore } from '@/store/auth.zustand'
import { type ForumCapability } from '@/store/helper/capabilities'

/**
 * Asks before an action whether the viewer may take it.
 *
 * A visitor is sent to log in, as every forum action already did. A member
 * whose role lacks the capability — a subscriber on a site that grants
 * subscribers nothing — used to get the form, fill it in, and be refused by the
 * server with "Failed to vote on post". They are told why up front instead. The
 * server stays the gate; this only spares the round trip and the guesswork.
 *
 * @returns a check that answers true when the action may go ahead
 */
export default function useCapabilityGate() {
  const { can, isLoggedIn } = useAuthStore()
  const { open: openLoginWarning } = useLoginWarningStore()
  const { notificationApi } = useContext(NotifyContext)

  return useCallback(
    (capability: ForumCapability): boolean => {
      if (!isLoggedIn) {
        openLoginWarning()
        return false
      }

      if (!can(capability)) {
        notificationApi?.info({
          description: __('Ask a site administrator if you think you should be able to.'),
          message: __('Your account does not have permission to do this.')
        })
        return false
      }

      return true
    },
    [can, isLoggedIn, notificationApi, openLoginWarning]
  )
}
