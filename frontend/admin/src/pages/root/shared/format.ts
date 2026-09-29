import { __, sprintf } from '@common/helpers/i18nWrap'

import { parseGmt } from '@/utils/format'

import { type DashboardPeriod, type StageProgress } from './types'

export const PERIOD_OPTIONS: { label: string; value: DashboardPeriod }[] = [
  { label: __('7 days'), value: '7d' },
  { label: __('30 days'), value: '30d' },
  { label: __('12 months'), value: '12m' }
]

/**
 * "+6 this month", as one translatable string per period rather than a number
 * glued to a fragment — word order is not the same in every language.
 */
export function deltaLabel(period: DashboardPeriod, value: number): string {
  if (period === '7d') return sprintf(__('+%d this week'), value)
  if (period === '12m') return sprintf(__('+%d this year'), value)
  return sprintf(__('+%d this month'), value)
}

/** Heading for the column that counts votes cast during the period. */
export function periodColumnLabel(period: DashboardPeriod): string {
  if (period === '7d') return __('This week')
  if (period === '12m') return __('This year')
  return __('This month')
}

/**
 * Used for a stage the admin never gave a colour, by its position: the first
 * stage is where topics wait, the last is where they ship, so neutral → blue →
 * amber → green reads as progress the way the portal's defaults do.
 */
const FALLBACK_STAGE_HUES = ['#94a3b8', '#3266ea', '#d97706', '#16a34a', '#7c3aed', '#0d9488']

/** Stage name → the colour it is drawn in everywhere on the dashboard. */
export function stageHues(stages: StageProgress[]): Map<string, string> {
  return new Map(
    stages.map((stage, index) => [
      stage.name,
      stage.color ?? FALLBACK_STAGE_HUES[index % FALLBACK_STAGE_HUES.length]
    ])
  )
}

/** "Feature Request, Bug Report, Feedback and 4 more". */
export function topicTypeSummary(names: string[]): string {
  if (names.length === 0) return __('No topic types yet')

  const shown = names.slice(0, 3)
  const rest = names.length - shown.length
  const items = rest > 0 ? [...shown, sprintf(__('%d more'), rest)] : shown

  return new Intl.ListFormat(undefined, { type: 'conjunction' }).format(items)
}

/**
 * The axis label for one bucket. The server sends the date and the browser
 * names it, so month and weekday names come out in the reader's language.
 */
export function bucketLabel(date: string, period: DashboardPeriod): string {
  const at = new Date(`${date}T00:00:00Z`)

  if (period === '12m') {
    return at.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }).toUpperCase()
  }

  if (period === '7d') {
    return at.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short' })
  }

  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "27 Sep 2026" from a GMT timestamp, in the reader's own date order. */
export function shortDate(value: string): string {
  const at = parseGmt(value)

  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Up to two initials for an avatar: "Sara Khan" → "SK", "admin" → "AD". */
export function initials(name: null | string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return (words[0][0] + words.at(-1)![0]).toUpperCase()
}
