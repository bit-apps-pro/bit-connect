import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

interface UpdateRoleCapabilitiesPayload {
  capabilities: Record<string, boolean>
  role: string
}

export default function useUpdateRoleCapabilities() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { isPending, mutateAsync } = useMutation({
    mutationFn: (payload: UpdateRoleCapabilitiesPayload) =>
      request('capability-settings/update', { body: payload, method: 'POST' }),
    onError: () => {
      messageApi?.error(__('Failed to update capabilities'))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capability-settings'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      messageApi?.success(__('Capabilities updated'))
    }
  })

  return {
    isUpdatingRoleCapabilities: isPending,
    updateRoleCapabilities: mutateAsync
  }
}
