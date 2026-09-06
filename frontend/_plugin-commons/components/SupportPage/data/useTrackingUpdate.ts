import request from '../../../../admin/src/common/helpers/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export default function useTrackingUpdate() {
  const queryClient = useQueryClient()

  const { isPending, mutateAsync } = useMutation({
    mutationFn: (allowTracking: boolean) =>
      request<{ allowTracking: boolean }>('pro_plugin-improvement', { allowTracking }, undefined, 'POST'),
    mutationKey: ['update-tracking'],
    onSuccess: data => {
      if (data.status === 'success') {
        queryClient.setQueryData(['tracking'], { data: { allowTracking: data?.data?.allowTracking } })
      }
    }
  })

  return {
    isUpdatingTracking: isPending,
    updateTracking: mutateAsync
  }
}
