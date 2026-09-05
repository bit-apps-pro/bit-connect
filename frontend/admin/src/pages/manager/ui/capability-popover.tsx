import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import CapabilityPopoverFree from './capability-popover.free'
import CapabilityPopoverPro, { type CapPopoverProps } from './capability-popover.pro'

/**
 * Dispatch only — see the two siblings. `IS_PRO_ACTIVE` folds to a literal in
 * the free build, so Rollup keeps exactly one of them.
 */
export default function CapabilityPopover(props: CapPopoverProps) {
  return IS_PRO_ACTIVE ? <CapabilityPopoverPro {...props} /> : <CapabilityPopoverFree {...props} />
}
