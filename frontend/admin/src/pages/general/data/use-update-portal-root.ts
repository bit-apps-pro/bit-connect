import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface UpdatePortalRootResponse {
  enabled: boolean
  url: string
}

export default function useUpdatePortalRoot() {
  const queryClient = useQueryClient()

  const { isPending, mutateAsync } = useMutation({
    mutationFn: (enabled: boolean) =>
      request<{ enabled: boolean }, UpdatePortalRootResponse>('portal-page/root', {
        body: { enabled },
        method: 'POST'
      }),
    mutationKey: ['portal-root-update'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-page'] })
    }
  })

  return {
    isUpdatingPortalRoot: isPending,
    updatePortalRoot: mutateAsync
  }
}
