import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

import config from '../../../config/config'

interface OnboardingStatus {
  completed: boolean
}

export default function useOnboardingStatus() {
  const { data, isPending } = useQuery<ResponseType<OnboardingStatus>, Error, OnboardingStatus>({
    // Onboarding is a manager's to finish, and the route refuses anyone else:
    // a moderator's every page load used to end in a 403 here.
    enabled: config.CAN_MANAGE,
    queryFn: ({ signal }) =>
      request<never, OnboardingStatus>('onboarding-status', { method: 'GET', signal }),
    queryKey: ['onboarding-status'],
    retry: false,
    select: response => response?.data ?? (response as unknown as OnboardingStatus)
  })

  return {
    isOnboardingCompleted: data?.completed ?? true,
    // A query that never runs stays pending; read as such, the guard would
    // draw nothing for a moderator, ever.
    isOnboardingStatusPending: config.CAN_MANAGE && isPending
  }
}
