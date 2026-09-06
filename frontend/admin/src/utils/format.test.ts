import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clockTime, dayLabel, fullDate, parseGmt, plain, timeAgo } from './format'

// Every timestamp the moderation tables store is GMT and none of them says so.
// A browser is free to read `2026-08-06 05:12:00` as local time, which turns
// "an hour ago" into "seven hours ago" for anyone east of London.
//
// The clock is pinned to local midday rather than to a fixed instant, and every
// input is derived from it, so the day-boundary assertions below mean the same
// thing in every time zone a developer might run them in.
const NOW = new Date(2026, 7, 27, 12, 0, 0)

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** A timestamp in the shape the tables store: GMT, with nothing saying so. */
function stored(at: Date): string {
  return at.toISOString().replace('T', ' ').slice(0, 19)
}

function ago(milliseconds: number): string {
  return stored(new Date(NOW.getTime() - milliseconds))
}

describe('parseGmt', () => {
  it('reads a stored timestamp as GMT rather than as local time', () => {
    expect(parseGmt('2026-08-06 05:12:00').toISOString()).toBe('2026-08-06T05:12:00.000Z')
  })

  it('reports something unparseable as an invalid date rather than guessing', () => {
    expect(Number.isNaN(parseGmt('not a timestamp').getTime())).toBe(true)
  })
})

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts in the largest unit that fits', () => {
    expect(timeAgo(ago(HOUR))).toBe('1 hour ago')
    expect(timeAgo(ago(DAY))).toBe('yesterday')
    expect(timeAgo(ago(7 * DAY))).toBe('last week')
    expect(timeAgo(ago(365 * DAY))).toBe('last year')
  })

  // The failure this avoids is "1 hours ago" in English, and worse in languages
  // with more than two plural forms.
  it('lets Intl pick the plural rather than building a sentence', () => {
    expect(timeAgo(ago(3 * HOUR))).toBe('3 hours ago')
    expect(timeAgo(ago(3 * DAY))).toBe('3 days ago')
  })

  it('falls through to seconds for something that just happened', () => {
    expect(timeAgo(ago(30_000))).toBe('30 seconds ago')
  })

  it('says nothing at all for a timestamp it cannot read', () => {
    expect(timeAgo('')).toBe('')
    expect(timeAgo('rubbish')).toBe('')
  })
})

describe('fullDate', () => {
  it('renders the timestamp in the reader’s own locale', () => {
    expect(fullDate('2026-08-06 05:12:00')).toBe(new Date('2026-08-06T05:12:00Z').toLocaleString())
  })

  it('is empty rather than "Invalid Date" for something unreadable', () => {
    expect(fullDate('rubbish')).toBe('')
  })
})

describe('clockTime', () => {
  it('gives just the clock for a row already filed under a day', () => {
    expect(clockTime('2026-08-06 05:12:00')).toBe(
      new Date('2026-08-06T05:12:00Z').toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      })
    )
  })

  it('is empty for something unreadable', () => {
    expect(clockTime('')).toBe('')
  })
})

describe('dayLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // A log is read from the top and the top is almost always today, so printing
  // the date there makes a reader work out what they already know.
  it('names today and yesterday instead of dating them', () => {
    expect(dayLabel(ago(4 * HOUR), 'Today', 'Yesterday')).toBe('Today')
    expect(dayLabel(ago(DAY), 'Today', 'Yesterday')).toBe('Yesterday')
  })

  it('dates anything older than that', () => {
    const week = ago(7 * DAY)

    expect(dayLabel(week, 'Today', 'Yesterday')).toBe(
      parseGmt(week).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: undefined
      })
    )
  })

  // "6 August 2026" in 2026 is noise.
  it('adds the year only once it is not this one', () => {
    expect(dayLabel(ago(2 * 365 * DAY), 'Today', 'Yesterday')).toContain('2024')
    expect(dayLabel(ago(7 * DAY), 'Today', 'Yesterday')).not.toContain('2026')
  })

  it('is empty for something unreadable', () => {
    expect(dayLabel('rubbish', 'Today', 'Yesterday')).toBe('')
  })

  // A day boundary is a calendar boundary, not twenty-four hours: half past
  // midnight is still today however few minutes ago midnight was.
  it('compares calendar days rather than elapsed hours', () => {
    vi.setSystemTime(new Date(2026, 7, 27, 0, 30, 0))

    expect(dayLabel(stored(new Date(2026, 7, 27, 0, 20, 0)), 'Today', 'Yesterday')).toBe('Today')
    expect(dayLabel(stored(new Date(2026, 7, 26, 23, 50, 0)), 'Today', 'Yesterday')).toBe('Yesterday')
  })
})

describe('plain', () => {
  it('reads stored HTML as the text a moderator sees', () => {
    expect(plain('<p>Hello <strong>there</strong></p>')).toBe('Hello there')
  })

  it('collapses the whitespace that stripping the tags leaves behind', () => {
    expect(plain('<p>one</p>\n\n<p>two</p>')).toBe('one two')
  })

  // Half its callers read out of an activity row's free-form context blob,
  // where a field is whatever the action that wrote it put there.
  it('answers empty for anything that is not a string', () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- an absent field is the case under test
    expect(plain(undefined)).toBe('')
    // eslint-disable-next-line unicorn/no-null -- a context blob's missing field arrives as null
    expect(plain(null)).toBe('')
    expect(plain(42)).toBe('')
    expect(plain({ post_title: 'x' })).toBe('')
  })

  it('leaves plain text alone', () => {
    expect(plain('  just words  ')).toBe('just words')
  })
})
