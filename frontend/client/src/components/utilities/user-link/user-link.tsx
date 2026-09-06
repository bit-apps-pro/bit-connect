import MemberBadge from '@utilities/member-badge'
import { Avatar } from 'antd'
import { Link } from 'react-router'

import { type MemberBadge as MemberBadgeType } from '@/types/member-badge'

/**
 * Route to a member's public profile.
 *
 * Addressed by slug (`/user/aiden-carter`), which every payload carrying an
 * author now includes as `author_slug` — so a byline can build the URL without
 * a lookup per author.
 */
export const userProfilePath = (slug: string) => `/user/${encodeURIComponent(slug)}`

interface UserLinkProps {
  avatar?: string
  /** Rendered before the name. Omit for name-only bylines. */
  avatarSize?: number
  /** The author's standing, printed after the name. Omit to show none. */
  badge?: MemberBadgeType | null
  className?: string
  name: string | undefined
  nameClassName?: string
  showAvatar?: boolean
  /** The author's profile slug. Absent for guests, who get plain text. */
  slug: string | undefined
}

/**
 * A member's avatar and name, linking to their profile.
 *
 * Falls back to plain text when there is no profile to link to — comments can
 * be left by guests, whose `user_id` is 0, and a link to `/user/0` would be a
 * dead end.
 *
 * Callers must not render this inside another anchor: nested links are invalid
 * and the inner one stops working. Where a whole card is already a link, the
 * byline has to sit outside it.
 */
export default function UserLink({
  avatar,
  avatarSize = 24,
  badge,
  className = '',
  name,
  nameClassName = '',
  showAvatar = true,
  slug
}: UserLinkProps) {
  const body = (
    <>
      {showAvatar && (
        <Avatar alt={name} className="bc-shrink-0" size={avatarSize} src={avatar}>
          {name?.charAt(0)?.toUpperCase()}
        </Avatar>
      )}
      <span className={`bc-truncate ${nameClassName}`}>{name}</span>
      {/* Inside the link on purpose: the badge belongs to the name, and a
          reader who clicks it means to open that member's profile. */}
      <MemberBadge badge={badge} />
    </>
  )

  const shared = `bc-flex bc-min-w-0 bc-items-center bc-gap-2 ${className}`

  // Inline rather than a helper: the check has to narrow `slug` to a string for
  // userProfilePath below, and a `Boolean`-style predicate does not.
  // Guest comments carry no slug and have no profile to link to.
  if (!slug) {
    return <span className={shared}>{body}</span>
  }

  return (
    <Link
      className={`${shared} bc-no-underline bc-transition-colors hover:bc-text-primary`}
      onClick={event => event.stopPropagation()}
      to={userProfilePath(slug)}
    >
      {body}
    </Link>
  )
}
