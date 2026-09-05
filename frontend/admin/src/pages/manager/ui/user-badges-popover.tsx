import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import UserBadgesPopoverFree from './user-badges-popover.free'
// The props type is erased at compile time, so naming it here costs the free
// bundle nothing — only the default import is a value, and that one folds away.
import UserBadgesPopoverPro, { type UserBadgesPopoverProps } from './user-badges-popover.pro'

/**
 * The Badges cell in a user row.
 *
 * Dispatch only — see the two siblings. `IS_PRO_ACTIVE` folds to a literal
 * `false` in the free build (the bundle flag is the left half of the `&&`), so
 * Rollup drops the pro cell and everything it imports from the free bundle
 * entirely; in the pro build the same constant still respects the license, so
 * an expired subscription falls back to the upsell cell rather than to a
 * working control whose requests the server would refuse.
 */
export default function UserBadgesPopover(props: UserBadgesPopoverProps) {
  return IS_PRO_ACTIVE ? <UserBadgesPopoverPro {...props} /> : <UserBadgesPopoverFree />
}
