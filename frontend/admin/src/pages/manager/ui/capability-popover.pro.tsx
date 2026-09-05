import { type ResponseType } from '@common/request/types'

import { type ForumCapability, type ForumUser } from '../shared/types'

/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `IS_PRO_ACTIVE` is a compile-time `false` in this build, so the dispatch in
 * `capability-popover.tsx` never renders this component and Rollup drops it
 * from the bundle. The module exists only so the import graph resolves and the
 * props type below stays available to `capability-popover.free.tsx`, which
 * imports it.
 */
export interface CapPopoverProps {
  disabled: boolean
  onReset: () => Promise<ResponseType<ForumUser>>
  onSave: (caps: Record<ForumCapability, boolean>) => Promise<void>
  user: ForumUser
}

export default function CapabilityPopoverPro(_props: CapPopoverProps) {
  return null
}
