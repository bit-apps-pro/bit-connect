import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import { type UserBadgesPopoverProps } from '../shared/types'
import UserBadgesPopoverFree from './user-badges-popover.free'
import UserBadgesPopoverPro from './user-badges-popover.pro'

/**
 * The Badges cell in a user row.
 *
 * Dispatch only — see the two siblings. `IS_PRO_ACTIVE` folds to a literal
 * `false` in the free build (the bundle flag is the left half of the `&&`), so
 * Rollup drops the pro cell and everything it imports from the free bundle
 * entirely.
 */
export default function UserBadgesPopover(props: UserBadgesPopoverProps) {
  return IS_PRO_ACTIVE ? <UserBadgesPopoverPro {...props} /> : <UserBadgesPopoverFree />
}
