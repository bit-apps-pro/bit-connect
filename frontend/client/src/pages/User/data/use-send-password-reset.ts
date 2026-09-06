import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import queryRequest, { type Response } from '@common/helpers/request'
import { useMutation } from '@tanstack/react-query'
import { useContext } from 'react'

interface SendPasswordResetResponse {
  message: string
}

/**
 * Email the signed-in member a link to set a new password.
 *
 * The escape hatch for anyone who cannot answer "current password" — most often
 * an account an SSO plugin created with a generated password its owner has
 * never seen. That case is indistinguishable from a normal one server-side, so
 * it cannot be detected and offered automatically; the way out has to be
 * something the member can reach for themselves.
 *
 * Sends no address. The endpoint always mails the account making the request.
 */
export default function useSendPasswordReset(userId: number | undefined) {
  const { notificationApi } = useContext(NotifyContext)

  const { isPending, mutateAsync } = useMutation<
    Response<SendPasswordResetResponse>,
    Response<string>,
    // No variables — the endpoint derives everything from the session. `void`
    // is TanStack's shape for that and is what makes the returned function
    // callable with no arguments; `undefined` in its place would satisfy this
    // rule only to trip unicorn/no-useless-undefined at every call site.
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
    void
  >({
    mutationFn: async () =>
      queryRequest<SendPasswordResetResponse>(`users/${Number(userId)}/password/reset-link`, {}),
    mutationKey: ['account', 'password-reset'],
    onError: error => {
      const msg =
        typeof error.data === 'string'
          ? error.data
          : ((error as unknown as { message?: string }).message ??
            __('Could not send the reset link. Please try again.'))

      notificationApi?.error({ message: msg })
    },
    onSuccess: () => {
      notificationApi?.success({
        description: __('Open it to set a new password.'),
        message: __('Reset link sent to your email')
      })
    }
  })

  return { isSendingPasswordReset: isPending, sendPasswordReset: mutateAsync }
}
