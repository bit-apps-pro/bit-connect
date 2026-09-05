import { describe, expect, it } from 'vitest'

import { reasonTint, severityOf } from './severity'

// The queue's unit is the reported item, not the report, so the only thing
// separating "one person is annoyed" from "the room agrees" is a number in a
// tag — which is exactly what a moderator scrolling a queue does not read.
// Colour carries it instead, so these thresholds are the feature.
describe('severityOf', () => {
  it('leaves a single report quiet', () => {
    expect(severityOf(1)).toEqual({
      chip: 'bc-bg-surface-raised bc-text-ink-muted',
      rail: 'bc-bg-line-strong'
    })
  })

  // Two is also the default auto-hide threshold — the point at which a queue
  // stops being unusual — so it warns rather than alarms.
  it('warns at two', () => {
    expect(severityOf(2).rail).toBe('bc-bg-tone-amber')
  })

  it('turns red at three and stays there', () => {
    expect(severityOf(3).rail).toBe('bc-bg-negative')
    expect(severityOf(30).rail).toBe('bc-bg-negative')
  })

  it('reads a card with no reports on it as quiet rather than as an error', () => {
    expect(severityOf(0).rail).toBe('bc-bg-line-strong')
  })

  it('moves the chip and the rail together', () => {
    for (const count of [0, 1, 2, 3, 10]) {
      const { chip, rail } = severityOf(count)

      expect(chip).not.toBe('')
      expect(rail).not.toBe('')
    }
  })
})

describe('reasonTint', () => {
  it('tints the reasons that need a moderator today like the warnings they are', () => {
    for (const slug of ['abuse', 'harassment', 'illegal']) {
      expect(reasonTint(slug)).toBe('bc-bg-negative-soft bc-text-negative')
    }
  })

  it('marks spam as a nuisance rather than an emergency', () => {
    expect(reasonTint('spam')).toBe('bc-bg-tone-amber-soft bc-text-tone-amber')
  })

  it('keeps everything else quiet', () => {
    expect(reasonTint('other')).toBe('bc-bg-surface-sunken bc-text-ink-muted')
  })

  // A slug the server adds later falling through to neutral is the right way to
  // be wrong: a new reason reads as ordinary rather than as an alarm.
  it('falls through to neutral for a reason it has never seen', () => {
    expect(reasonTint('invented-next-release')).toBe('bc-bg-surface-sunken bc-text-ink-muted')
    expect(reasonTint('')).toBe('bc-bg-surface-sunken bc-text-ink-muted')
  })
})
