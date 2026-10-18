import config from '@config/config'

/**
 * Dates on the site's clock — the timezone set under Settings → General.
 *
 * Every timestamp the server sends is a GMT instant, and a browser left to
 * itself names that instant on the reader's own clock. A forum is one place
 * with one clock: a moderator in Dhaka and one in London reading the same log
 * must see the same "Today" and the same 09:15, and both must match the times
 * WordPress itself prints.
 *
 * WordPress stores either an IANA name (`Asia/Dhaka`) or, for a manual offset,
 * `+06:00`. Not every engine accepts an offset as an Intl zone, so one that is
 * refused is applied by hand: the instant is moved by the offset and named on
 * UTC's clock. A value neither form can read falls back to the reader's clock.
 */
interface Zone {
  /** Milliseconds added before formatting — non-zero only for a manual offset. */
  shift: number
  timeZone?: string
}

const OFFSET = /^([+-])(\d{2}):?(\d{2})$/

export function resolveZone(name: string): Zone {
  if (!name) return { shift: 0 }

  try {
    new Intl.DateTimeFormat(undefined, { timeZone: name })

    return { shift: 0, timeZone: name }
  } catch {
    const match = OFFSET.exec(name)

    if (!match) return { shift: 0 }

    const minutes = Number(match[2]) * 60 + Number(match[3])

    return { shift: (match[1] === '-' ? -1 : 1) * minutes * 60_000, timeZone: 'UTC' }
  }
}

const SITE_ZONE = resolveZone(config.TIME_ZONE)

/** What `toLocaleString()` prints with no options: numeric date, clock with seconds. */
export const FULL_DATE_TIME: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  month: 'numeric',
  second: '2-digit',
  year: 'numeric'
}

/** `Intl.DateTimeFormat` on the site's clock, in the reader's language. */
export function formatSiteTime(at: Date, options: Intl.DateTimeFormatOptions, zone = SITE_ZONE): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: zone.timeZone }).format(
    new Date(at.getTime() + zone.shift)
  )
}

/** The calendar day an instant falls on at the site, as a whole day count. */
function siteDay(at: Date, zone: Zone): { day: number; year: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'numeric',
    timeZone: zone.timeZone,
    year: 'numeric'
  }).formatToParts(new Date(at.getTime() + zone.shift))
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value)
  const year = part('year')

  return { day: Date.UTC(year, part('month') - 1, part('day')) / 86_400_000, year }
}

/**
 * How many site days ago `at` was — 0 for today, 1 for yesterday — and whether
 * it falls in the site's current year.
 */
export function siteDaysAgo(at: Date, now = new Date(), zone = SITE_ZONE): { days: number; sameYear: boolean } {
  const then = siteDay(at, zone)
  const today = siteDay(now, zone)

  return { days: today.day - then.day, sameYear: then.year === today.year }
}
