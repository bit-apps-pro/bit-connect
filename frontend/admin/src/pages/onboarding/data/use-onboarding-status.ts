import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

interface OnboardingStatus {
  completed: boolean
}

export default function useOnboardingStatus() {
  const { data, isPending } = useQuery<ResponseType<OnboardingStatus>, Error, OnboardingStatus>({
    queryFn: ({ signal }) =>
      request<never, OnboardingStatus>('onboarding-status', { method: 'GET', signal }),
    queryKey: ['onboarding-status'],
    retry: false,
    select: response => response?.data ?? (response as unknown as OnboardingStatus)
  })

  return {
    isOnboardingCompleted: data?.completed ?? true,
    isOnboardingStatusPending: isPending
  }
}
