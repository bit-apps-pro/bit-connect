import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import queryRequest, { type Response } from '@common/helpers/request'
import { useMutation } from '@tanstack/react-query'
import { type FormInstance } from 'antd'
import { useContext } from 'react'

import { useAuthStore } from '@/store/auth.zustand'

export interface RequestEmailChangePayload {
  email: string
}

interface RequestEmailChangeResponse {
  message: string
  pending_email: string
}

/**
 * Ask to move the account to a different email address.
 *
 * Nothing changes on success — the address is parked until the member clicks
 * the link sent to it. checkAuth() is still called so the form can read the
 * pending address back and say so, rather than looking as though the request
 * was swallowed.
 */
export default function useRequestEmailChange(form: FormInstance, userId: number | undefined) {
  const { notificationApi } = useContext(NotifyContext)
  const { checkAuth } = useAuthStore()

  const { isPending, mutateAsync } = useMutation<
    Response<RequestEmailChangeResponse>,
    Response<string> | Response<ValidationType<RequestEmailChangePayload>>,
    RequestEmailChangePayload
  >({
    mutationFn: async data =>
      queryRequest<RequestEmailChangeResponse>(`users/${Number(userId)}/email`, data),
    mutationKey: ['account', 'email'],
    onError: error => {
      if (error.code === 'VALIDATION' && error.data && typeof error.data === 'object') {
        form.setFields(
          Object.entries(error.data).map(([key, messages]) => ({ errors: messages, name: key }))
        )
        return
      }

      const msg =
        typeof error.data === 'string'
          ? error.data
          : ((error as unknown as { message?: string }).message ??
            __('Could not start the email change. Please try again.'))

      notificationApi?.error({ message: msg })
    },
    onSuccess: async response => {
      notificationApi?.success({
        description: __('Open it from that inbox to finish the change.'),
        message: __('Confirmation link sent')
      })
      form.setFieldsValue({ email: response.data?.pending_email ?? '' })
      await checkAuth()
    }
  })

  return { isRequestingEmailChange: isPending, requestEmailChange: mutateAsync }
}
