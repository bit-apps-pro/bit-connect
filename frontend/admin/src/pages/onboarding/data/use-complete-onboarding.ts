import { request } from '@common/request'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export default function useCompleteOnboarding() {
  const queryClient = useQueryClient()

  const { isPending, mutateAsync } = useMutation({
    mutationFn: () =>
      request('onboarding-complete', {
        method: 'POST'
      }),
    mutationKey: ['onboarding-complete'],
    onSuccess: () => {
      queryClient.setQueryData(['onboarding-status'], { completed: true })
    }
  })

  return {
    completeOnboarding: mutateAsync,
    isCompletingOnboarding: isPending
  }
}
