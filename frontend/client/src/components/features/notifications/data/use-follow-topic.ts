import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import post from '@/utils/request/post'

/**
 * What the Follow button should say.
 *
 * `following` and `muted` are not opposites. A member who never followed a
 * thread and one who muted it are both "not following", but only the second has
 * made a decision — and that decision is what stops auto-follow resubscribing
 * them the next time they reply.
 */
export interface FollowState {
  following: boolean
  muted: boolean
  /** 'auto' when the forum subscribed them for taking part, 'manual' when they asked. */
  source: string
}

interface TogglePayload {
  follow: boolean
  target_id: number
  target_type: string
}

export const RESTING_FOLLOW_STATE: FollowState = { following: false, muted: false, source: '' }

/**
 * Follow or unfollow one thing.
 *
 * The button is optimistic: following a thread is reversible, instant and
 * unimportant if it fails, so making the member wait on a round trip to see the
 * word change costs more than the rare wrong frame. The server's answer is
 * authoritative and replaces the guess — it is re-read from storage rather than
 * inferred, because unfollow mutes rather than deletes.
 */
export default function useFollowTopic(topicId: number, initial: FollowState) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<FollowState>(initial)

  const { isPending, mutateAsync } = useMutation({
    mutationFn: (follow: boolean) =>
      post<TogglePayload, FollowState>('follows/toggle', {
        body: { follow, target_id: topicId, target_type: 'topic' }
      }),
    onError: (_error, follow) => {
      // Put the button back. Leaving it showing the state the member asked for
      // would tell them they are following something they are not.
      setState(current => ({ ...current, following: !follow }))
    },
    onMutate: follow => {
      setState(current => ({ ...current, following: follow }))
    },
    onSuccess: response => {
      if (response?.data) setState(response.data)

      // The follow list on the profile is now wrong, and so is anything that
      // counts what this member is subscribed to.
      return queryClient.invalidateQueries({ queryKey: ['follows'] })
    }
  })

  return {
    followState: state,
    isTogglingFollow: isPending,
    toggleFollow: (follow: boolean) => mutateAsync(follow)
  }
}
