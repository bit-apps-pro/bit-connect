export type ForumCapability =
  | 'forum_create_comment'
  | 'forum_create_post'
  | 'forum_delete_any'
  | 'forum_delete_own_comment'
  | 'forum_delete_own_post'
  | 'forum_edit_own_comment'
  | 'forum_edit_own_post'
  | 'forum_lock_post'
  | 'forum_manage'
  | 'forum_moderate'
  | 'forum_pin_post'
  | 'forum_vote_comment'
  | 'forum_vote_post'

export const FORUM_CAPABILITY_LABELS: Record<ForumCapability, string> = {
  forum_create_comment: 'Create Comments',
  forum_create_post: 'Create Posts',
  forum_delete_any: 'Delete Any Content',
  forum_delete_own_comment: 'Delete Own Comments',
  forum_delete_own_post: 'Delete Own Posts',
  forum_edit_own_comment: 'Edit Own Comments',
  forum_edit_own_post: 'Edit Own Posts',
  forum_lock_post: 'Lock Topics',
  forum_manage: 'Manage Forum',
  forum_moderate: 'Moderate',
  forum_pin_post: 'Pin Topics',
  forum_vote_comment: 'Vote Comments',
  forum_vote_post: 'Vote Posts'
}

export const ALL_FORUM_CAPABILITIES: ForumCapability[] = Object.keys(
  FORUM_CAPABILITY_LABELS
) as ForumCapability[]

export interface ForumUser {
  avatar: string
  /**
   * Ids of the profile badges this member wears, unresolved.
   *
   * Ids rather than resolved badges because the row draws the catalog with
   * ticks — it needs to know what is ticked even for an id the catalog no
   * longer answers to, which is what a deleted badge leaves behind.
   */
  badges: string[]
  /** Effective capabilities (role defaults merged with user-level overrides) */
  capabilities: Record<ForumCapability, boolean>
  /** Explicit user-level overrides only. Present = override set; true = granted, false = revoked */
  capOverrides: Partial<Record<ForumCapability, boolean>>
  display_name: string
  ID: number
  roles: string[]
  user_email: string
  user_login: string
}

/**
 * How a badge looks. Mirrors the `BadgeTone` enum — a closed set, because the
 * value is used as a style key on both sides.
 */
export type BadgeTone = 'admin' | 'amber' | 'green' | 'moderator' | 'neutral' | 'teal' | 'violet'

/**
 * A badge an admin authored, as stored in the catalog.
 *
 * `id` is assigned on create and never changes: members store ids, so renaming
 * Developer to Engineering has to leave everyone wearing it still wearing it.
 */
export interface ProfileBadge {
  id: string
  label: string
  tone: BadgeTone
}

export interface ProfileBadgesResponse {
  /** In priority order. The first one a member wears is what bylines print. */
  badges: ProfileBadge[]
  /** Catalog ceiling, so the screen can say why Add is disabled. */
  maxBadges: number
  /** How many badges one member may wear at once. */
  maxPerMember: number
  tones: { label: string; value: BadgeTone }[]
}

/** Text and tint per tone, matching the portal's own map so the admin preview
 *  shows what a member will actually see. */
export const BADGE_TONE_STYLES: Record<BadgeTone, string> = {
  admin: 'bc-bg-negative-soft bc-text-negative',
  amber: 'bc-bg-tone-amber-soft bc-text-tone-amber',
  green: 'bc-bg-positive-soft bc-text-positive',
  moderator: 'bc-bg-info-soft bc-text-info',
  neutral: 'bc-bg-surface-raised bc-text-ink-muted',
  teal: 'bc-bg-tone-teal-soft bc-text-tone-teal',
  violet: 'bc-bg-tone-violet-soft bc-text-tone-violet'
}

export interface UsersResponse {
  page: number
  per_page: number
  total: number
  total_pages: number
  users: ForumUser[]
}
