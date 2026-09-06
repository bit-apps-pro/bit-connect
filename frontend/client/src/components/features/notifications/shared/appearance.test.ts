import { LuBell, LuShieldAlert } from 'react-icons/lu'
import { describe, expect, it } from 'vitest'

import appearanceFor from './appearance'

// A list where every row is an avatar and a sentence forces the reader to read
// each one to find the reply among the upvotes. The badge is what lets them
// find it by shape and colour first — so the colours here carry meaning and are
// not decoration.
describe('appearanceFor', () => {
  it('gives every notification the portal sends a badge of its own', () => {
    const types = [
      'badge_awarded',
      'comment_reply',
      'content_actioned',
      'mention',
      'report_filed',
      'report_resolved',
      'topic_new',
      'topic_reply',
      'topic_status_changed',
      'vote_received'
    ]

    for (const type of types) {
      expect(appearanceFor(type).Icon).not.toBe(LuBell)
    }
  })

  // Red is only ever moderation acting on your own content, and nothing else in
  // the list should be able to look as serious as that does.
  it('keeps red for the one notification that means your content was taken down', () => {
    expect(appearanceFor('content_actioned')).toEqual({
      bg: 'bc-bg-negative-soft',
      fg: 'bc-text-negative',
      Icon: LuShieldAlert
    })

    const others = ['comment_reply', 'mention', 'topic_reply', 'vote_received', 'badge_awarded']

    for (const type of others) {
      expect(appearanceFor(type).bg).not.toBe('bc-bg-negative-soft')
    }
  })

  // Amber is only ever something waiting on a decision.
  it('keeps amber for the notifications that are waiting on somebody', () => {
    for (const type of ['report_filed', 'report_resolved', 'badge_awarded']) {
      expect(appearanceFor(type).bg).toBe('bc-bg-tone-amber-soft')
    }
  })

  it('reads a reply and a mention as different things at a glance', () => {
    expect(appearanceFor('comment_reply').Icon).not.toBe(appearanceFor('mention').Icon)
    expect(appearanceFor('comment_reply').bg).not.toBe(appearanceFor('mention').bg)
  })

  // A server newer than the bundle is a normal state during a rollout.
  it('gives a type this build has never seen a badge rather than a hole', () => {
    expect(appearanceFor('invented_next_release')).toEqual({
      bg: 'bc-bg-surface-sunken',
      fg: 'bc-text-ink-muted',
      Icon: LuBell
    })
    expect(appearanceFor('')).toEqual({
      bg: 'bc-bg-surface-sunken',
      fg: 'bc-text-ink-muted',
      Icon: LuBell
    })
  })

  // The badge disc is a soft token and the glyph on it a solid one; swapping
  // them puts a solid fill behind an icon that has no contrast against it.
  it('pairs a soft disc with a solid glyph everywhere', () => {
    for (const type of ['mention', 'vote_received', 'topic_new', 'unknown']) {
      const { bg, fg } = appearanceFor(type)

      expect(bg.startsWith('bc-bg-')).toBe(true)
      expect(fg.startsWith('bc-text-')).toBe(true)
    }
  })
})
