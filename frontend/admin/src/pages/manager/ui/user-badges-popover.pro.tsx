import { type UserBadgesPopoverProps } from '../shared/types'

/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `IS_PRO_ACTIVE` is a compile-time `false` in this build, so the dispatch in
 * `user-badges-popover.tsx` never renders this component and Rollup drops it
 * from the bundle. The module exists only so the import graph resolves; the
 * props contract lives in `manager/shared/types.ts`, which both editions import.
 */
export default function UserBadgesPopover(_props: UserBadgesPopoverProps) {
  return null
}
