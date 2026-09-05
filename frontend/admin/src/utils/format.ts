/**
 * Reading the values the moderation tables store, shared by Reports and Activity.
 *
 * Both screens read the same two awkward shapes — GMT timestamps with no zone
 * marker, and stored HTML shown as plain text — and both got them wrong in
 * their own way before this file existed.
 */

/**
 * Parses a timestamp that is GMT but does not say so.
 *
 * Without the `Z` a browser is free to read `2026-08-06 05:12:00` as local time,
 * which turns "an hour ago" into "seven hours ago" for anyone east of London.
 */
export const parseGmt = (value: string) => new Date(value.replace(' ', 'T') + 'Z')

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60]
]

/**
 * "3 hours ago", in the reader's own language.
 *
 * Intl does the counting and the plural, so this never has to build a sentence
 * out of a number and a translated fragment — which is the thing that produces
 * "1 hours ago" in English and worse in languages with more than two plurals.
 */
export function timeAgo(value: string): string {
  const at = parseGmt(value)

  if (Number.isNaN(at.getTime())) return ''

  const seconds = (at.getTime() - Date.now()) / 1000
  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }

  return relative.format(Math.round(seconds), 'second')
}

/** The full date, for the tooltip behind a relative time. */
export function fullDate(value: string): string {
  const at = parseGmt(value)

  return Number.isNaN(at.getTime()) ? '' : at.toLocaleString()
}

/** Just the clock, for a row already filed under a day heading. */
export function clockTime(value: string): string {
  const at = parseGmt(value)

  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * The day a timestamp falls on, as a heading.
 *
 * Today and yesterday are named rather than dated: a log is read from the top
 * and the top is almost always today, so printing the date there makes a reader
 * work out what they already know.
 */
export function dayLabel(value: string, todayText: string, yesterdayText: string): string {
  const at = parseGmt(value)

  if (Number.isNaN(at.getTime())) return ''

  const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.round((midnight(new Date()).getTime() - midnight(at).getTime()) / 86_400_000)

  if (days === 0) return todayText
  if (days === 1) return yesterdayText

  return at.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    // A year only once it is not this one. "6 August 2026" in 2026 is noise.
    year: at.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  })
}

/**
 * Strips tags: excerpts are stored HTML, shown here as plain text.
 *
 * Takes `unknown` because half its callers read out of an activity row's
 * free-form context blob, where a field is whatever the action that wrote it
 * put there — a missing one has to come back empty, not throw.
 */
export const plain = (html: unknown) =>
  typeof html === 'string'
    ? html
        .replaceAll(/<[^>]*>/g, ' ')
        .replaceAll(/\s+/g, ' ')
        .trim()
    : ''
