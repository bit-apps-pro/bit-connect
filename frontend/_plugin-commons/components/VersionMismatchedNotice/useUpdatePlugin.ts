import { useMutation, useQueryClient } from '@tanstack/react-query'

import request from '../../../admin/src/common/helpers/request'

export default function useUpdatePlugin() {
  const queryClient = useQueryClient()
  const { isPending, mutateAsync } = useMutation({
    mutationFn: () => request(`pro_update-plugin`, undefined, undefined, 'GET'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pro_update-plugin'] })
    }
  })

  return {
    isLoadingUpdatePlugin: isPending,
    updatePlugin: () => mutateAsync()
  }
}
