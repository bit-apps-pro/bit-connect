import { type UserCapabilitiesAdmin } from './use-user-capabilities-admin'

/**
 * Per-user overrides without the add-on: nothing to call.
 *
 * A constant rather than a stubbed mutation — the endpoint does not exist in a
 * free-only install, so asking would be a guaranteed 404. The Manager row reads
 * `canOverride` and renders the role matrix as the whole capability model,
 * which is what this plugin implements.
 */
export default function useUserCapabilitiesAdminFree(): UserCapabilitiesAdmin {
  return {
    canOverride: false,
    isUpdating: false,
    saveUserCapabilities: async () => {
      /* No per-user override endpoint here. Capabilities are set per role. */
    }
  }
}
