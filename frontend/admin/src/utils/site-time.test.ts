import { describe, expect, it } from 'vitest'

import { formatSiteTime, resolveZone, siteDaysAgo } from './site-time'

const CLOCK: Intl.DateTimeFormatOptions = { hour: '2-digit', hour12: false, minute: '2-digit' }

describe('resolveZone', () => {
  it('passes an IANA name straight to Intl', () => {
    expect(resolveZone('Asia/Dhaka')).toEqual({ shift: 0, timeZone: 'Asia/Dhaka' })
  })

  it('leaves the reader’s clock in charge when the site sent nothing', () => {
    expect(resolveZone('')).toEqual({ shift: 0 })
  })

  it('falls back to the reader’s clock for a value it cannot read', () => {
    expect(resolveZone('Not/AZone')).toEqual({ shift: 0 })
  })
})

describe('formatSiteTime', () => {
  const at = new Date('2026-08-06T20:30:00Z')

  it('names the instant on the site’s clock, not the reader’s', () => {
    expect(formatSiteTime(at, CLOCK, resolveZone('Asia/Dhaka'))).toBe('02:30')
    expect(formatSiteTime(at, CLOCK, resolveZone('America/New_York'))).toBe('16:30')
  })

  it('applies a manual offset WordPress stores as ±HH:MM', () => {
    expect(formatSiteTime(at, CLOCK, { shift: 5.75 * 3_600_000, timeZone: 'UTC' })).toBe('02:15')
    expect(formatSiteTime(at, CLOCK, { shift: -3 * 3_600_000, timeZone: 'UTC' })).toBe('17:30')
  })
})

describe('siteDaysAgo', () => {
  const now = new Date('2026-08-06T20:30:00Z')

  it('turns the day over at the site’s midnight', () => {
    const lateLondonEvening = new Date('2026-08-06T19:00:00Z')

    // 01:00 on the 7th in Dhaka — the same day as `now` there.
    expect(siteDaysAgo(lateLondonEvening, now, resolveZone('Asia/Dhaka')).days).toBe(0)
    // But in Dhaka, 17:00 GMT is 23:00 on the 6th — yesterday.
    expect(siteDaysAgo(new Date('2026-08-06T17:00:00Z'), now, resolveZone('Asia/Dhaka')).days).toBe(1)
  })

  it('reports whether the day is in the site’s current year', () => {
    const newYearsEve = new Date('2026-12-31T20:00:00Z')
    const zone = resolveZone('Asia/Tokyo')

    expect(siteDaysAgo(newYearsEve, new Date('2027-01-01T02:00:00Z'), zone)).toEqual({
      days: 0,
      sameYear: true
    })
    expect(siteDaysAgo(newYearsEve, new Date('2027-01-01T02:00:00Z'), resolveZone('UTC')).sameYear).toBe(false)
  })
})
