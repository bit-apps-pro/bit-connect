import { type ProfileBadge } from '../shared/types'

export interface BadgesAdmin {
  /** The catalog, in priority order. Empty unless a plugin keeps one. */
  catalog: ProfileBadge[]
  /**
   * Whether this install can author and assign badges at all.
   *
   * The Manager table asks before drawing the Badges column. This plugin keeps
   * no catalog, so the column is not drawn — an always-empty column is not a
   * column, it is a placeholder for something the plugin cannot do.
   */
  hasBadgeCatalog: boolean
  isSavingBadges: boolean
  /** How many badges one member may wear at once. */
  maxPerMember: number
  saveUserBadges: (userId: number, badgeIds: string[]) => Promise<void>
}

/**
 * Nothing to fetch, nothing to save.
 *
 * A constant rather than a stubbed query — this plugin has no badge endpoints,
 * so asking would be a guaranteed 404 on every Manager load.
 */
const EMPTY_CATALOG: BadgesAdmin['catalog'] = []

/**
 * Everything the Manager screen needs to know about badges, in one hook.
 *
 * The page could call the catalog and assignment hooks directly; it asks here
 * instead so the screen has a single answer to "does this install do badges at
 * all", and so the call site stays one unconditional hook call whatever that
 * answer is.
 */
export default function useBadgesAdmin(): BadgesAdmin {
  return {
    catalog: EMPTY_CATALOG,
    hasBadgeCatalog: false,
    isSavingBadges: false,
    maxPerMember: 0,
    saveUserBadges: async () => {
      /* No catalog to assign from, and no Badges column that could ask. */
    }
  }
}
