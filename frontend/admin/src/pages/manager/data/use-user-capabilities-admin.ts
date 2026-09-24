import { type ForumCapability } from '../shared/types'

export interface UserCapabilitiesAdmin {
  /** Whether a per-user override can be granted at all on this install. */
  canOverride: boolean
  isUpdating: boolean
  /** Grants/revokes overrides for one member. */
  saveUserCapabilities: (
    userId: number,
    capabilities: Partial<Record<ForumCapability, boolean>>
  ) => Promise<void>
}

/**
 * Granting one member capabilities on top of their role.
 *
 * This plugin's capability model is per role, so there is no endpoint for this
 * and nothing to call. A constant rather than a stubbed mutation: asking would
 * be a guaranteed 404. The Manager row reads `canOverride` and renders the role
 * matrix as the whole capability model, which is what this plugin implements.
 *
 * Resetting overrides is *not* here: it is `use-reset-user-capabilities`, it
 * calls this plugin's own endpoint, and it works on every install. A site must
 * always be able to take back a permission, whichever plugins it has installed.
 */
export default function useUserCapabilitiesAdmin(): UserCapabilitiesAdmin {
  return {
    canOverride: false,
    isUpdating: false,
    saveUserCapabilities: async () => {
      /* No per-user override endpoint here. Capabilities are set per role. */
    }
  }
}
