import { type Response } from '@common/helpers/request'
import { queryClient } from '@config/query-client'
import { beforeEach, describe, expect, it } from 'vitest'

import { type UserStats } from '@/pages/Post/data/use-user-stats'
import { type ProfileResponse } from '@/pages/User/data/use-user-profile'

import { syncVotesReceived } from './user-stats-sync'

const makeStats = (votesReceived: number): UserStats => ({
  comments: 4,
  registered_at: '2023-01-01 00:00:00',
  topics: 2,
  votes_received: votesReceived
})

const envelope = <T>(data: T): Response<T> => ({ code: 'SUCCESS', data, status: 'success' })

const seedStats = (userId: number, votesReceived: number) => {
  queryClient.setQueryData(['user-stats', userId], envelope(makeStats(votesReceived)))
}

const seedProfile = (slug: string, userId: number, votesReceived: number) => {
  queryClient.setQueryData(
    ['user-profile', slug],
    envelope({
      stats: makeStats(votesReceived),
      user: { display_name: 'Aiden', id: userId, slug }
    } as ProfileResponse)
  )
}

const readStats = (userId: number) =>
  queryClient.getQueryData<Response<UserStats>>(['user-stats', userId])?.data.votes_received

const readProfile = (slug: string) =>
  queryClient.getQueryData<Response<ProfileResponse>>(['user-profile', slug])?.data.stats?.votes_received

describe('syncVotesReceived', () => {
  beforeEach(() => {
    queryClient.clear()
  })

  it('adds a vote to both cached copies of the author totals', () => {
    seedStats(7, 10)
    seedProfile('aiden-carter', 7, 10)

    syncVotesReceived(7, true)

    expect(readStats(7)).toBe(11)
    expect(readProfile('aiden-carter')).toBe(11)
  })

  it('takes a vote back when the server reports the vote was removed', () => {
    seedStats(7, 10)

    syncVotesReceived(7, false)

    expect(readStats(7)).toBe(9)
  })

  it('accepts the string author id the REST payloads carry', () => {
    seedStats(7, 10)

    syncVotesReceived('7', true)

    expect(readStats(7)).toBe(11)
  })

  it('leaves other members alone', () => {
    seedProfile('someone-else', 9, 3)

    syncVotesReceived(7, true)

    expect(readProfile('someone-else')).toBe(3)
  })

  it('never shows a negative total', () => {
    seedStats(7, 0)

    syncVotesReceived(7, false)

    expect(readStats(7)).toBe(0)
  })

  it('ignores a guest comment, which carries no author id', () => {
    seedStats(7, 10)

    syncVotesReceived('0', true)
    syncVotesReceived('', true)

    expect(readStats(7)).toBe(10)
  })

  it('does nothing when the author has no cached totals yet', () => {
    expect(() => syncVotesReceived(7, true)).not.toThrow()
    expect(readStats(7)).toBeUndefined()
  })
})
