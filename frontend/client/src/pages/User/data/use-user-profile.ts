import queryRequest from '@common/helpers/request'
import { useQuery } from '@tanstack/react-query'

import { type UserStats } from '@/pages/Post/data/use-user-stats'
import { type MemberBadge } from '@/types/member-badge'

/**
 * Public identity of a portal member.
 *
 * Mirrors what the endpoint returns by allow-list — no email, login or role is
 * sent for a profile, so none is modelled here either.
 */
export interface UserProfile {
  avatar: string
  /**
   * The badge a byline would print for them, or null when they carry none.
   * Prefer this over `role_label` for styling: the label is renameable, `tone`
   * is not. Always the first entry of `badges`.
   */
  badge: MemberBadge | null
  /**
   * Every badge they carry, highest priority first. A member can be handed
   * several — Developer and Support — and this card has the room to show them
   * where an inline byline does not.
   */
  badges?: MemberBadge[]
  /** Short self-description they wrote, or '' when they have not. */
  bio: string
  /** Banner image URL, or null when the card should draw its gradient. */
  cover: null | string
  display_name: string
  /** Whether they uploaded a picture, or are falling back to Gravatar. */
  has_custom_avatar: boolean
  has_custom_cover: boolean
  id: number
  /** Their most recent topic or comment, or null if they have posted neither. */
  last_active_at: null | string
  registered_at: string
  /** Coarse standing — Member, Moderator or Admin. Not the raw WordPress role. */
  role_label: string
  /** URL slug this member is addressed by. */
  slug: string
  /** Only the networks they filled in; see MemberProfileService::LINK_KEYS. */
  social_links: Partial<Record<SocialLinkKey, string>>
}

/** The networks a member may publish. Mirrors MemberProfileService::LINK_KEYS. */
export const SOCIAL_LINK_KEYS = ['website', 'twitter', 'github', 'linkedin', 'mastodon'] as const

export type SocialLinkKey = (typeof SOCIAL_LINK_KEYS)[number]

export interface ProfileResponse {
  stats: undefined | UserStats
  user: UserProfile
}

/**
 * Identity and totals for a member's profile page.
 *
 * One request rather than two: the header renders the name and the numbers
 * together, and splitting them makes the stats pop in after the name has
 * already painted.
 *
 * Takes the URL's slug. This is also the resolution step for the rest of the
 * page — the remaining endpoints are addressed by numeric id, which only
 * arrives with this response.
 */
export default function useUserProfile(identifier: string | undefined) {
  const enabled = Boolean(identifier)

  const { data, error, isLoading } = useQuery({
    enabled,
    queryFn: async ({ signal }) =>
      queryRequest<ProfileResponse>(
        `users/${encodeURIComponent(identifier ?? '')}/profile`,
        {},
        undefined,
        'GET',
        { signal }
      ),
    queryKey: ['user-profile', identifier],
    // A missing user is a 404 the page renders as "not found" — retrying it
    // just delays that by a few seconds.
    retry: false,
    select: res => res?.data,
    staleTime: 5 * 60 * 1000
  })

  return {
    isLoadingProfile: isLoading,
    // `enabled: false` leaves the query idle rather than errored, so treat a
    // missing slug in the URL as "not found" too.
    notFound: !enabled || Boolean(error) || (!isLoading && !data?.user),
    profile: data?.user,
    stats: data?.stats,
    /** Numeric id the slug resolved to; the other endpoints key off this. */
    userId: data?.user?.id
  }
}
