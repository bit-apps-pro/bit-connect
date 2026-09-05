import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import queryRequest, { type Response } from '@common/helpers/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormInstance } from 'antd'
import { useContext } from 'react'

import { useAuthStore } from '@/store/auth.zustand'

import { type SocialLinkKey, type UserProfile } from './use-user-profile'

export interface UpdateProfilePayload {
  bio: string
  display_name: string
  links: Partial<Record<SocialLinkKey, string>>
  slug: string
}

interface UpdateProfileResponse {
  user: UserProfile
}

/**
 * Save the member's own profile details.
 *
 * One request for all four fields because they are one form — sending them
 * separately would let a rejected slug land alongside an already-saved name.
 */
export default function useUpdateProfile(form: FormInstance, userId: number | undefined) {
  const { notificationApi } = useContext(NotifyContext)
  const queryClient = useQueryClient()
  const { checkAuth } = useAuthStore()

  const { isPending, mutateAsync } = useMutation<
    Response<UpdateProfileResponse>,
    Response<string> | Response<ValidationType<UpdateProfilePayload>>,
    UpdateProfilePayload
  >({
    mutationFn: async data =>
      queryRequest<UpdateProfileResponse>(`users/${Number(userId)}/profile`, data),
    mutationKey: ['user-profile', 'update'],
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
            __('Could not save your profile. Please check your connection and try again.'))

      notificationApi?.error({ message: msg })
    },
    onSuccess: async () => {
      notificationApi?.success({ message: __('Profile updated') })
      // Keyed on the prefix only: the profile query's key carries the URL slug,
      // which a numeric id would never match.
      await queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      // Feeds embed the author's name in their rows, so they keep showing the
      // old one until refetched.
      await queryClient.invalidateQueries({ queryKey: ['user-content'] })
      // The header reads the auth store rather than TanStack Query, so without
      // this the name in the account menu stays stale until a full page load —
      // and so does `slug`, which the "My Profile" link is built from.
      await checkAuth()
    }
  })

  return { isUpdatingProfile: isPending, updateProfile: mutateAsync }
}
