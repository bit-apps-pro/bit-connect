/**
 * Reading the values the moderation tables store, shared by Reports and Activity.
 *
 * Both screens read the same two awkward shapes — GMT timestamps with no zone
 * marker, and stored HTML shown as plain text — and both got them wrong in
 * their own way before this file existed.
 */

import { formatSiteTime, FULL_DATE_TIME, siteDaysAgo } from './site-time'

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

  return Number.isNaN(at.getTime()) ? '' : formatSiteTime(at, FULL_DATE_TIME)
}

/** Just the clock, for a row already filed under a day heading. */
export function clockTime(value: string): string {
  const at = parseGmt(value)

  return Number.isNaN(at.getTime()) ? '' : formatSiteTime(at, { hour: '2-digit', minute: '2-digit' })
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

  // Counted on the site's calendar, so "Today" turns over at the site's
  // midnight and matches the clock time printed beside each row.
  const { days, sameYear } = siteDaysAgo(at)

  if (days === 0) return todayText
  if (days === 1) return yesterdayText

  return formatSiteTime(at, {
    day: 'numeric',
    month: 'long',
    // A year only once it is not this one. "6 August 2026" in 2026 is noise.
    year: sameYear ? undefined : 'numeric'
  })
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  rsquo: '’'
}

/**
 * Decodes character references once.
 *
 * One pass on purpose: `&amp;gt;` is someone who typed "&gt;", and decoding the
 * result again would turn their text into ">".
 */
const decodeEntities = (value: string) =>
  value.replaceAll(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, ref: string) => {
    if (ref[0] !== '#') return NAMED_ENTITIES[ref.toLowerCase()] ?? entity

    const hex = ref[1] === 'x' || ref[1] === 'X'
    const code = Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10)

    return code > 0 && code <= 0x10_ff_ff ? String.fromCodePoint(code) : entity
  })

/**
 * Stored HTML as plain text: tags out, entities decoded.
 *
 * Decoding is not optional — the editor writes `>` as `&gt;`, and React prints
 * a string verbatim, so a comment saying "man>>" would read "man&gt;&gt;".
 *
 * Takes `unknown` because half its callers read out of an activity row's
 * free-form context blob, where a field is whatever the action that wrote it
 * put there — a missing one has to come back empty, not throw.
 */
export const plain = (html: unknown) =>
  typeof html === 'string'
    ? decodeEntities(html.replaceAll(/<[^>]*>/g, ' '))
        .replaceAll(/\s+/g, ' ')
        .trim()
    : ''
