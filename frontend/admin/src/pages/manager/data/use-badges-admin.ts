import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import { type ProfileBadge } from '../shared/types'
import useBadgesAdminFree from './use-badges-admin.free'
import useBadgesAdminPro from './use-badges-admin.pro'

export interface BadgesAdmin {
  /** The catalog, in priority order. Empty without the pro add-on. */
  catalog: ProfileBadge[]
  isSavingBadges: boolean
  /** How many badges one member may wear at once. */
  maxPerMember: number
  saveUserBadges: (userId: number, badgeIds: string[]) => Promise<void>
}

/**
 * Everything the Manager screen needs to know about badges, in one hook.
 *
 * The page used to call `useProfileBadges` and `useUpdateUserBadges` directly,
 * which would have pulled both — and the pro-only endpoints they call — into
 * the free bundle. Selecting the implementation at module scope keeps the free
 * build free of them while leaving the call site a single unconditional hook
 * call, so the rules of hooks still hold: which implementation is chosen cannot
 * change while the app is running.
 */
const useBadgesAdmin: () => BadgesAdmin = IS_PRO_ACTIVE ? useBadgesAdminPro : useBadgesAdminFree

export default useBadgesAdmin
