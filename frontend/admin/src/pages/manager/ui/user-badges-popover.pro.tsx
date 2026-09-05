import { type ForumUser, type ProfileBadge } from '../shared/types'

/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `IS_PRO_ACTIVE` is a compile-time `false` in this build, so the dispatch in
 * `user-badges-popover.tsx` never renders this component and Rollup drops it
 * from the bundle. The module exists only so the import graph resolves and the
 * props type below stays available to the dispatch, which names it.
 */
export interface UserBadgesPopoverProps {
  /** The catalog, in priority order. */
  catalog: ProfileBadge[]
  disabled: boolean
  maxPerMember: number
  onSave: (badgeIds: string[]) => Promise<unknown>
  user: ForumUser
}

export default function UserBadgesPopover(_props: UserBadgesPopoverProps) {
  return null
}
