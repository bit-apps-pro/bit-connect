import { type BadgesAdmin } from './use-badges-admin'

/**
 * Badges without the pro add-on: nothing to fetch, nothing to save.
 *
 * A constant rather than a stubbed query — the endpoints do not exist in a
 * free-only install, so asking would be a guaranteed 404 on every Manager load.
 */
const EMPTY_CATALOG: BadgesAdmin['catalog'] = []

export default function useBadgesAdminFree(): BadgesAdmin {
  return {
    catalog: EMPTY_CATALOG,
    isSavingBadges: false,
    maxPerMember: 0,
    saveUserBadges: async () => {
      /* No catalog to assign from. The free cell opens the upsell instead. */
    }
  }
}
