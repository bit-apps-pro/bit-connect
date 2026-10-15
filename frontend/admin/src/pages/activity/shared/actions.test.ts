import { LuHistory, LuTrash2 } from 'react-icons/lu'
import { describe, expect, it } from 'vitest'

import { lookOf } from './actions'

// On a screen that is mostly one action repeated — a busy forum auto-hides far
// more often than a moderator does anything — the icon and the tint are what
// let a reader find the three rows that were a decision.
//
// The tint groups by what the action did to the content's availability, which
// is the axis a moderator reads a log along.
describe('lookOf', () => {
  it('marks the actions that took content away as destructive', () => {
    for (const action of ['delete_post', 'delete_comment']) {
      expect(lookOf(action).tint).toBe('bc-bg-negative-soft bc-text-negative')
      expect(lookOf(action).Icon).toBe(LuTrash2)
    }
  })

  it('marks the actions that shut something down as restricting', () => {
    for (const action of ['hide', 'lock_post']) {
      expect(lookOf(action).tint).toBe('bc-bg-tone-amber-soft bc-text-tone-amber')
    }
  })

  it('marks the actions that opened something back up as positive', () => {
    for (const action of ['restore', 'unlock_post', 'resolve_reports']) {
      expect(lookOf(action).tint).toBe('bc-bg-positive-soft bc-text-positive')
    }
  })

  it('gives every mapped action an icon of its own', () => {
    const mapped = [
      'delete_comment',
      'delete_post',
      'hide',
      'lock_post',
      'resolve_reports',
      'restore',
      'unlock_post'
    ]

    for (const action of mapped) {
      expect(lookOf(action).Icon).not.toBe(LuHistory)
    }
  })

  // A server newer than the bundle is a normal state during a rollout. A pencil
  // or a bin against an unmapped slug would assert what it did.
  it('gives a slug it has never seen a row rather than a hole', () => {
    expect(lookOf('invented_next_release')).toEqual({
      Icon: LuHistory,
      tint: 'bc-bg-surface-raised bc-text-ink-muted'
    })
    expect(lookOf('')).toEqual({ Icon: LuHistory, tint: 'bc-bg-surface-raised bc-text-ink-muted' })
  })
})
