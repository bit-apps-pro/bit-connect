/**
 * How loudly a queue entry should read.
 *
 * The queue's unit is the reported item, not the report, so the only thing
 * separating "one person is annoyed" from "the room agrees" is a number in a
 * tag — and a number in a tag is exactly what a moderator scrolling a queue
 * does not read. Colour carries it instead: the rail down the left of a card
 * and the count chip move together, so how bad a thing is arrives before the
 * words do.
 *
 * Three is where it turns red rather than two, because two is also the default
 * auto-hide threshold — the point at which a queue stops being unusual.
 */
export interface Severity {
  /** The count chip: tint plus the text that sits on it. */
  chip: string
  /** The rail down the left edge of the card. */
  rail: string
}

export function severityOf(count: number): Severity {
  if (count >= 3) {
    return { chip: 'bc-bg-negative-soft bc-text-negative', rail: 'bc-bg-negative' }
  }

  if (count === 2) {
    return { chip: 'bc-bg-tone-amber-soft bc-text-tone-amber', rail: 'bc-bg-tone-amber' }
  }

  return { chip: 'bc-bg-surface-raised bc-text-ink-muted', rail: 'bc-bg-line-strong' }
}

/**
 * Reason tints, so a queue can be triaged without reading every chip.
 *
 * Reasons are not equally serious and the list is short and fixed, so the three
 * that need a moderator today are tinted like the warnings they are and the
 * rest stay quiet. Slugs the server adds later fall through to neutral, which
 * is the right way to be wrong.
 */
const SERIOUS = new Set(['abuse', 'harassment', 'illegal'])
const NUISANCE = new Set(['spam'])

export function reasonTint(slug: string): string {
  if (SERIOUS.has(slug)) return 'bc-bg-negative-soft bc-text-negative'
  if (NUISANCE.has(slug)) return 'bc-bg-tone-amber-soft bc-text-tone-amber'

  return 'bc-bg-surface-sunken bc-text-ink-muted'
}
