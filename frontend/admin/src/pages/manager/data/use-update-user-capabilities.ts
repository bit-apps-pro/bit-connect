import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type ForumCapability, type ForumUser } from '../shared/types'

interface UpdatePayload {
  capabilities: Partial<Record<ForumCapability, boolean>>
  userId: number
}

export default function useUpdateUserCapabilities() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  // See use-reset-user-capabilities: `request` resolves to the response
  // envelope, so that is what the mutation actually yields.
  const { isPending, mutateAsync } = useMutation<ResponseType<ForumUser>, Error, UpdatePayload>({
    mutationFn: ({ capabilities, userId }) =>
      request<{ capabilities: UpdatePayload['capabilities'] }, ForumUser>(
        `users/${userId}/capabilities`,
        { body: { capabilities }, method: 'POST' }
      ),
    onError: () => {
      messageApi?.error(__('Failed to update user capabilities'))
    },
    onSuccess: () => {
      messageApi?.success(__('User capabilities updated'))
      queryClient.invalidateQueries({ queryKey: ['users'] })
    }
  })

  return {
    isUpdating: isPending,
    updateUserCapabilities: mutateAsync
  }
}
