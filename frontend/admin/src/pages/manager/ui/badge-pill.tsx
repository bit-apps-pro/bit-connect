import { BADGE_TONE_STYLES, type BadgeTone } from '../shared/types'

interface BadgePillProps {
  className?: string
  label: string
  tone: BadgeTone
}

/**
 * A badge drawn the way the portal draws it.
 *
 * Deliberately not an antd Tag: the point of showing a badge on the admin
 * screen is to answer "what will members see", and a Tag would answer it in
 * antd's palette and radius instead of the portal's. The class strings are the
 * same tokens the portal's own MemberBadge reaches for.
 */
export default function BadgePill({ className = '', label, tone }: BadgePillProps) {
  return (
    <span
      className={`bc-inline-flex bc-shrink-0 bc-items-center bc-rounded-full bc-px-2 bc-py-0.5 bc-text-[11px] bc-font-semibold bc-leading-none ${
        BADGE_TONE_STYLES[tone] ?? BADGE_TONE_STYLES.neutral
      } ${className}`}
    >
      {label}
    </span>
  )
}
