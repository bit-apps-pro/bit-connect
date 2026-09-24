/**
 * The forum capabilities the REST layer checks, mirrored from
 * `backend/app/Enum/Capabilities.php`. Keep the two lists in step — a slug that
 * exists only here silently resolves to "not allowed".
 */
export type ForumCapability =
  | 'bit_connect_forum_create_comment'
  | 'bit_connect_forum_create_post'
  | 'bit_connect_forum_delete_any'
  | 'bit_connect_forum_delete_own_comment'
  | 'bit_connect_forum_delete_own_post'
  | 'bit_connect_forum_edit_own_comment'
  | 'bit_connect_forum_edit_own_post'
  | 'bit_connect_forum_lock_post'
  | 'bit_connect_forum_manage'
  | 'bit_connect_forum_moderate'
  | 'bit_connect_forum_pin_post'
  | 'bit_connect_forum_vote_post'

/** cap => granted. Partial: an older payload may not carry every slug. */
export type CapabilityMap = Partial<Record<ForumCapability, boolean>>

/** The user shape this module needs — a subset of the auth store's `User`. */
interface CapabilityCarrier {
  capabilities?: CapabilityMap
  role?: null | string
  roles?: string[]
}

/**
 * Roles the portal used to treat as "can moderate" before the server sent
 * capabilities. Only reachable through the fallback below.
 */
const LEGACY_MODERATOR_ROLES = ['administrator', 'bit_connect_moderator']

/**
 * Capabilities every logged-in member was assumed to hold before the server
 * sent a real map: the portal showed Edit and Delete to whoever owned the
 * content, and asked the server only when they acted on it.
 */
const LEGACY_OWNER_CAPS = [
  'bit_connect_forum_create_comment',
  'bit_connect_forum_create_post',
  'bit_connect_forum_delete_own_comment',
  'bit_connect_forum_delete_own_post',
  'bit_connect_forum_edit_own_comment',
  'bit_connect_forum_edit_own_post',
  'bit_connect_forum_vote_post'
] as const satisfies readonly ForumCapability[]

/**
 * What to assume when a payload carries no capability map at all.
 *
 * Reachable from the WordPress-core fallback endpoint, which cannot report
 * forum capabilities, and from a page still holding a bootstrap payload written
 * by an older build. Reproducing the portal's previous behaviour keeps those
 * paths working: the server is still the gate, so an optimistic control here
 * costs a 403, never an unauthorised write. Anything that reaches the real map
 * below never consults this.
 */
function legacyFallback(user: CapabilityCarrier): CapabilityMap {
  const isLegacyModerator = LEGACY_MODERATOR_ROLES.some(
    role => user.roles?.includes(role) || user.role === role
  )

  const caps: CapabilityMap = {
    // bit_connect_forum_moderate used to carry removal too, and a payload old enough to
    // reach this fallback predates the split, so a legacy moderator held it.
    // Its edit counterpart is deliberately absent: that capability has been
    // withdrawn, and the fallback must not hand back a power the server will
    // refuse — the Edit button would appear on other people's posts and answer
    // 403 on every click.
    bit_connect_forum_delete_any: isLegacyModerator,
    bit_connect_forum_lock_post: isLegacyModerator,
    bit_connect_forum_manage: isLegacyModerator,
    bit_connect_forum_moderate: isLegacyModerator,
    bit_connect_forum_pin_post: isLegacyModerator
  }

  for (const cap of LEGACY_OWNER_CAPS) caps[cap] = true

  return caps
}

/**
 * The capability map for a user, or an empty one for a guest.
 *
 * A guest holds nothing, so every check answers false without a special case at
 * the call site.
 */
export function capabilitiesOf(user?: CapabilityCarrier): CapabilityMap {
  if (!user) return {}

  return user.capabilities ?? legacyFallback(user)
}

/** Whether a capability map grants `capability`. */
export function hasCapability(caps: CapabilityMap, capability: ForumCapability): boolean {
  return caps[capability] === true
}
