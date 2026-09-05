import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface UpdatePortalSlugResponse {
  hasShortcode: boolean
  /** A published page answers to the new slug. */
  pageExists: boolean
  slug: string
  url: string
}

export default function useUpdatePortalSlug() {
  const queryClient = useQueryClient()

  const { isPending, mutateAsync } = useMutation({
    mutationFn: (slug: string) =>
      request<{ slug: string }, UpdatePortalSlugResponse>('portal-page/slug', {
        body: { slug },
        method: 'POST'
      }),
    mutationKey: ['portal-slug-update'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-page'] })
    }
  })

  return {
    isUpdatingPortalSlug: isPending,
    updatePortalSlug: mutateAsync
  }
}
