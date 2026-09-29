import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import queryRequest, { type Response } from '@common/helpers/request'
import { useMutation } from '@tanstack/react-query'
import { useContext } from 'react'

import { useAuthStore } from '@/store/auth.zustand'

interface CancelEmailChangeResponse {
  message: string
}

/**
 * Drop a pending email change, so the confirmation link already sent stops
 * working.
 *
 * checkAuth() afterwards clears `pending_email` from the auth store, which is
 * what takes the pending notice off the form.
 */
export default function useCancelEmailChange(userId: number | undefined) {
  const { notificationApi } = useContext(NotifyContext)
  const { checkAuth } = useAuthStore()

  const { isPending, mutateAsync } = useMutation<
    Response<CancelEmailChangeResponse>,
    Response<string>,
    // No variables — see use-send-password-reset.ts.
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    void
  >({
    mutationFn: async () =>
      queryRequest<CancelEmailChangeResponse>(`users/${Number(userId)}/email/cancel`, {}),
    mutationKey: ['account', 'email-cancel'],
    onError: error => {
      const msg =
        typeof error.data === 'string'
          ? error.data
          : ((error as unknown as { message?: string }).message ??
            __('Could not cancel the email change. Please try again.'))

      notificationApi?.error({ message: msg })
    },
    onSuccess: async () => {
      notificationApi?.success({ message: __('Email change cancelled') })
      await checkAuth()
    }
  })

  return { cancelEmailChange: mutateAsync, isCancellingEmailChange: isPending }
}
