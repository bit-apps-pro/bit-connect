import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import { type ForumCapability } from '../shared/types'
import useUserCapabilitiesAdminFree from './use-user-capabilities-admin.free'
import useUserCapabilitiesAdminPro from './use-user-capabilities-admin.pro'

export interface UserCapabilitiesAdmin {
  /** Whether a per-user override can be granted at all on this install. */
  canOverride: boolean
  isUpdating: boolean
  /** Grants/revokes overrides for one member. A no-op without the add-on. */
  saveUserCapabilities: (
    userId: number,
    capabilities: Partial<Record<ForumCapability, boolean>>
  ) => Promise<void>
}

/**
 * Granting one member capabilities on top of their role.
 *
 * This plugin has no endpoint for it — the route, the request and the write all
 * ship in the Bit Connect Pro add-on — so the free implementation has nothing
 * to call and says so. Selecting at module scope rather than inside a component
 * keeps the call site a single unconditional hook call, so the rules of hooks
 * still hold, and keeps the pro endpoint's name out of the free bundle.
 *
 * Resetting overrides is *not* here: it is `use-reset-user-capabilities`, it
 * calls this plugin's own endpoint, and it works on every install. A site must
 * always be able to take back a permission, whatever happened to its licence.
 */
const useUserCapabilitiesAdmin: () => UserCapabilitiesAdmin = IS_PRO_ACTIVE
  ? useUserCapabilitiesAdminPro
  : useUserCapabilitiesAdminFree

export default useUserCapabilitiesAdmin
