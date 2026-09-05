import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import queryRequest, { type Response } from '@common/helpers/request'
import { useMutation } from '@tanstack/react-query'
import { setNonce } from '@utils/request/nonce'
import { type FormInstance } from 'antd'
import { useContext } from 'react'

import { useAuthStore } from '@/store/auth.zustand'

export interface ChangePasswordPayload {
  /** Omitted for an account that has none — see AuthService::hasUsablePassword(). */
  current_password?: string
  new_password: string
}

interface ChangePasswordResponse {
  message: string
  /** Fresh `wp_rest` nonce — see below for why it is not optional in practice. */
  nonce?: string
}

/**
 * Change the signed-in member's password.
 *
 * Setting a password destroys every session for that user, including the one
 * making this request, so the endpoint re-authenticates and mints a new
 * `wp_rest` nonce. Storing it is not housekeeping — skip it and the very next
 * request from this page fails the cookie nonce check with a 403.
 */
export default function useChangePassword(form: FormInstance, userId: number | undefined) {
  const { notificationApi } = useContext(NotifyContext)
  const { checkAuth } = useAuthStore()

  const { isPending, mutateAsync } = useMutation<
    Response<ChangePasswordResponse>,
    Response<string> | Response<ValidationType<ChangePasswordPayload>>,
    ChangePasswordPayload
  >({
    mutationFn: async data =>
      queryRequest<ChangePasswordResponse>(`users/${Number(userId)}/password`, data),
    mutationKey: ['account', 'password'],
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
            __('Could not change your password. Please try again.'))

      notificationApi?.error({ message: msg })
    },
    onSuccess: async response => {
      setNonce(response.data?.nonce)
      form.resetFields()
      notificationApi?.success({ message: __('Your password has been changed') })
      // Flips has_password for an account that just got its first one, so the
      // form stops offering to set one and starts asking for the current one.
      await checkAuth()
    }
  })

  return { changePassword: mutateAsync, isChangingPassword: isPending }
}
