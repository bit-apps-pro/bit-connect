import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type ForumUser } from '../shared/types'

export default function useResetUserCapabilities() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  // `request` resolves to the `{ status, code, data }` envelope, not the user
  // itself — declaring `ForumUser` here made callers read fields off the
  // envelope and silently get `undefined`.
  const { isPending, mutateAsync } = useMutation<ResponseType<ForumUser>, Error, number>({
    mutationFn: (userId: number) =>
      request<never, ForumUser>(`users/${userId}/capabilities/reset`, { method: 'POST' }),
    onError: () => {
      messageApi?.error(__('Failed to reset capabilities'))
    },
    onSuccess: () => {
      messageApi?.success(__('Capabilities reset to role defaults'))
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })

  return {
    isResetting: isPending,
    resetUserCapabilities: mutateAsync
  }
}
