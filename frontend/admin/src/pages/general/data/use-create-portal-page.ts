import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface CreatePortalPageResponse {
  slug: string
  url: string
}

/** The onboarding wizard's one-time page creation under a chosen slug. */
export default function useCreatePortalPage() {
  const queryClient = useQueryClient()

  const { isPending, mutateAsync } = useMutation({
    mutationFn: (slug: string) =>
      request<{ slug: string }, CreatePortalPageResponse>('portal-page', {
        body: { slug },
        method: 'POST'
      }),
    mutationKey: ['portal-page-create'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-page'] })
      queryClient.invalidateQueries({ queryKey: ['portal-slug-check'] })
    }
  })

  return { createPortalPage: mutateAsync, isCreatingPortalPage: isPending }
}
