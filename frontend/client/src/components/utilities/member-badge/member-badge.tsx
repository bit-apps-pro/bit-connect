import { type BadgeTone, type MemberBadge as MemberBadgeType } from '@/types/member-badge'

/**
 * Colour per tone, never per label. An admin names their own badges and a site
 * can rename the standing ones through the `bit_connect_member_badge` filter,
 * so a label-keyed map would drop every renamed badge to the fallback.
 *
 * Every `BadgeTone` needs an entry — the type makes that a compile error rather
 * than an unstyled pill in a byline.
 */
const TONE_STYLES: Record<BadgeTone, string> = {
  admin: 'bc-bg-negative-soft bc-text-negative',
  amber: 'bc-bg-tone-amber-soft bc-text-tone-amber',
  green: 'bc-bg-positive-soft bc-text-positive',
  moderator: 'bc-bg-info-soft bc-text-info',
  neutral: 'bc-bg-surface-raised bc-text-ink-muted',
  teal: 'bc-bg-tone-teal-soft bc-text-tone-teal',
  violet: 'bc-bg-tone-violet-soft bc-text-tone-violet'
}

const SIZE_STYLES = {
  md: 'bc-px-2 bc-py-0.5 bc-text-[11px]',
  sm: 'bc-px-1.5 bc-py-px bc-text-[10px]'
} as const

interface MemberBadgeProps {
  badge: MemberBadgeType | null | undefined
  className?: string
  /** `sm` for inline bylines, `md` for the profile card. */
  size?: keyof typeof SIZE_STYLES
}

/**
 * A member's standing, beside their name.
 *
 * Renders nothing for members without one, so a byline can drop this in
 * unconditionally instead of guarding at every call site.
 */
export default function MemberBadge({ badge, className = '', size = 'sm' }: MemberBadgeProps) {
  // An empty fragment rather than null: the lint rules bar the null literal, and
  // this is the shape AppRoutes already uses to render nothing.
  if (!badge) return <></>

  return (
    <span
      className={`bc-shrink-0 bc-rounded-full bc-font-semibold bc-leading-none ${SIZE_STYLES[size]} ${TONE_STYLES[badge.tone]} ${className}`}
    >
      {badge.label}
    </span>
  )
}
