import { type Response } from '@common/helpers/request'
import { queryClient } from '@config/query-client'

import { type UserStats } from '@/pages/Post/data/use-user-stats'
import { type ProfileResponse } from '@/pages/User/data/use-user-profile'

/**
 * Move a member's "Upvotes" total after a vote on something they wrote.
 *
 * The vote endpoint reports the new total for the topic or comment, not for its
 * author, and the author's totals live in a separate query keyed by a different
 * id — so nothing in that response reaches them. Writing the delta into the
 * cache moves the number on their card at the same moment the vote button
 * flips; the refetch that follows replaces the guess with what the server
 * counts, which is current because the vote dropped its cached copy there too.
 *
 * @param authorId who wrote the voted-on topic or comment
 * @param hasVoted the vote state the server just confirmed — true is a vote
 *                 added, false one taken back
 */
export function syncVotesReceived(authorId: number | string, hasVoted: boolean): void {
  const id = Number(authorId)

  // Guest comments carry no author id, and there is nothing to move for them.
  if (!Number.isFinite(id) || id <= 0) return

  const delta = hasVoted ? 1 : -1
  // A total can only be wrong low here if the cached copy was already behind;
  // showing a negative count of upvotes would be worse than showing zero.
  const bump = (stats: UserStats): UserStats => ({
    ...stats,
    votes_received: Math.max(0, stats.votes_received + delta)
  })

  queryClient.setQueryData<Response<UserStats>>(
    ['user-stats', id],
    previous => previous && { ...previous, data: bump(previous.data) }
  )

  // Profiles are keyed by slug, which a vote never carries, so every cached
  // profile is offered the update and the one for this member takes it.
  queryClient.setQueriesData<Response<ProfileResponse>>({ queryKey: ['user-profile'] }, previous => {
    if (!previous?.data.stats || previous.data.user?.id !== id) return previous

    return {
      ...previous,
      data: { ...previous.data, stats: bump(previous.data.stats) }
    }
  })

  void queryClient.invalidateQueries({ queryKey: ['user-stats', id] })
  void queryClient.invalidateQueries({ queryKey: ['user-profile'] })
}
