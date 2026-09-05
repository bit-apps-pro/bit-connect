/**
 * How a badge looks, independent of what it says.
 *
 * A closed set, mirroring the `BadgeTone` enum: `tone` is used as a style key,
 * so a value outside this union would render an unstyled pill. `admin` and
 * `moderator` are what the automatic standing badge resolves to; the rest are
 * palette choices an admin makes when authoring a badge of their own.
 */
export type BadgeTone = 'admin' | 'amber' | 'green' | 'moderator' | 'neutral' | 'teal' | 'violet'

/**
 * A badge shown beside a member's name, as resolved server-side by
 * `UserBadgeService`.
 *
 * `null` on every payload where the member carries none — an ordinary member's
 * byline shows no badge at all, so callers render on presence rather than
 * comparing against a label meaning "nothing to show".
 */
export interface MemberBadge {
  /**
   * The catalog badge this came from, or `null` for the automatic standing
   * badge, which is derived from capabilities and so has no catalog entry.
   * Useful as a list key; not something to branch on.
   */
  id?: null | string
  /**
   * What to print. Not a fixed set: an admin names their own badges, and a site
   * can rename the standing ones through the `bit_connect_member_badge` filter.
   * Never branch on this — branch on `tone`.
   */
  label: string
  /** Which look to use. Drives colour; safe to switch on. */
  tone: BadgeTone
}
