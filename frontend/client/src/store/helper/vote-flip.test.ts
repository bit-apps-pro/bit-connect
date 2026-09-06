import { describe, expect, it } from 'vitest'

import { flipVote } from './vote-flip'

describe('flipVote', () => {
  it('adds the vote the reader just cast', () => {
    expect(flipVote({ hasVoted: false, total: 3 })).toEqual({ hasVoted: true, total: 4 })
  })

  it('takes back a vote that was already theirs', () => {
    expect(flipVote({ hasVoted: true, total: 4 })).toEqual({ hasVoted: false, total: 3 })
  })

  it('never guesses a negative count', () => {
    expect(flipVote({ hasVoted: true, total: 0 })).toEqual({ hasVoted: false, total: 0 })
  })

  it('leaves the rest of the record alone', () => {
    expect(flipVote({ hasVoted: false, id: 9, total: 1 })).toEqual({
      hasVoted: true,
      id: 9,
      total: 2
    })
  })
})
