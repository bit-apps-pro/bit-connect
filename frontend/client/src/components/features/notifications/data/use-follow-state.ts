import { useQuery } from '@tanstack/react-query'

import get from '@/utils/request/get'

import { type FollowState, RESTING_FOLLOW_STATE } from './use-follow-topic'

/**
 * Whether the signed-in member follows one thing, for a page that did not
 * arrive with the answer.
 *
 * A topic carries its follow state in its own payload; a tag archive has no
 * payload of its own, so its Follow button asks here. Not asked for a guest:
 * the answer is a constant, and the request would only be refused.
 */
export default function useFollowState(targetType: string, targetId: number, isLoggedIn: boolean) {
  const { data, isPending } = useQuery({
    enabled: isLoggedIn && targetId > 0,
    queryFn: ({ signal }) =>
      get<FollowState>('follows/state', {
        queryParam: { target_id: targetId, target_type: targetType },
        signal
      }),
    queryKey: ['follows', 'state', targetType, targetId]
  })

  if (!isLoggedIn) return { followState: RESTING_FOLLOW_STATE, isLoadingFollowState: false }

  return {
    followState: data?.data,
    isLoadingFollowState: isPending
  }
}
