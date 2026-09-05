import { __ } from '@common/helpers/i18nWrap'
import MemberBadge from '@utilities/member-badge'
import { Skeleton } from 'antd'
import {
  LuAtSign,
  LuCake,
  LuClock3,
  LuGithub,
  LuGlobe,
  LuLinkedin,
  LuSettings,
  LuTwitter
} from 'react-icons/lu'

import { type UserStats } from '@/pages/Post/data/use-user-stats'
import { relativeTime } from '@/utils/utils'

import { SOCIAL_LINK_KEYS, type SocialLinkKey, type UserProfile } from '../data/use-user-profile'
import AvatarEditor from './AvatarEditor'

const formatCount = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k` : String(value)

const LINK_ICONS: Record<SocialLinkKey, React.ReactNode> = {
  github: <LuGithub size={14} />,
  linkedin: <LuLinkedin size={14} />,
  mastodon: <LuAtSign size={14} />,
  twitter: <LuTwitter size={14} />,
  website: <LuGlobe size={14} />
}

/**
 * A link the way people read one: host and path, without the scheme or the
 * trailing slash. The full URL stays in href.
 */
const displayUrl = (url: string | undefined) => {
  if (!url) return ''
  try {
    const { host, pathname } = new URL(url)
    return `${host}${pathname === '/' ? '' : pathname}`
  } catch {
    return url
  }
}

const fullDate = (iso: string | undefined) => {
  if (!iso) return
  const date = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * The quiet pill an ordinary member gets. Staff standings are drawn by
 * MemberBadge, which is keyed by tone — this map used to key off the printed
 * label, so renaming Moderator to Team would have dropped it to this style.
 */
const PLAIN_MEMBER_STYLE = 'bc-bg-surface-sunken bc-text-ink-muted'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bc-flex bc-flex-col">
      <span className="bc-text-[16px] bc-font-semibold bc-leading-none bc-text-ink">{value}</span>
      <span className="bc-mt-1 bc-text-[11px] bc-text-ink-subtle">{label}</span>
    </div>
  )
}

function MetaLine({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="bc-flex bc-items-center bc-gap-2 bc-text-[12px] bc-text-ink-muted">
      <span aria-hidden="true" className="bc-flex bc-shrink-0 bc-text-ink-subtle">
        {icon}
      </span>
      {children}
    </div>
  )
}

/**
 * Identity card for the profile's right rail.
 *
 * Replaces the earlier full-width banner: with the feed as the primary column,
 * the identity belongs beside it rather than above, so scrolling the feed does
 * not scroll the person away. The cover strip is kept as a thin accent to give
 * the avatar something to sit against.
 */
export default function ProfileCard({
  canEditAvatar,
  isLoading,
  onManage,
  profile,
  stats
}: {
  canEditAvatar: boolean
  isLoading: boolean
  onManage?: () => void
  profile: undefined | UserProfile
  stats: undefined | UserStats
}) {
  const joined = fullDate(profile?.registered_at ?? stats?.registered_at)
  const role = profile?.role_label ?? 'Member'
  const badges = profile?.badges ?? (profile?.badge ? [profile.badge] : [])

  return (
    <section
      aria-label={__('Profile')}
      className="bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface"
    >
      {/* The gradient is the fallback, not a placeholder — members without a
          cover keep it, and it is what the avatar sits against. */}
      {profile?.cover ? (
        <img alt="" className="bc-h-14 bc-w-full bc-object-cover" src={profile.cover} />
      ) : (
        <div className="bc-h-14 bc-bg-gradient-to-r bc-from-primary bc-to-[#7B9BF5]" />
      )}

      <div className="bc-px-4 bc-pb-4">
        <div className="bc--mt-8 bc-mb-3">
          <AvatarEditor
            avatar={profile?.avatar}
            canEdit={canEditAvatar}
            hasCustomAvatar={Boolean(profile?.has_custom_avatar)}
            name={profile?.display_name}
            userId={profile?.id}
          />
        </div>

        {isLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} title={{ width: '60%' }} />
        ) : (
          <>
            <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-2">
              <h1 className="bc-m-0 bc-text-[19px] bc-font-semibold bc-leading-tight bc-text-ink">
                {profile?.display_name}
              </h1>
              {/* All of them here, where a byline shows only the first: this
                  page is about one person and has the width to say Developer
                  and Support both. `badges` is optional on the type because a
                  cached payload from before it existed has only `badge` — that
                  fallback keeps such a response showing one badge, not none. */}
              {badges.length > 0 ? (
                badges.map((badge, index) => (
                  <MemberBadge badge={badge} key={badge.id ?? `standing-${index}`} size="md" />
                ))
              ) : (
                <span
                  className={`bc-rounded-full bc-px-2 bc-py-0.5 bc-text-[11px] bc-font-semibold ${PLAIN_MEMBER_STYLE}`}
                >
                  {role}
                </span>
              )}
            </div>

            {profile?.bio && (
              <p className="bc-mb-0 bc-mt-2 bc-whitespace-pre-line bc-text-[13px] bc-leading-relaxed bc-text-ink-muted">
                {profile.bio}
              </p>
            )}

            {stats && (
              <div className="bc-mt-4 bc-grid bc-grid-cols-3 bc-gap-2">
                <Stat label={__('Topics')} value={formatCount(stats.topics)} />
                <Stat label={__('Comments')} value={formatCount(stats.comments)} />
                <Stat label={__('Upvotes')} value={formatCount(stats.votes_received)} />
              </div>
            )}

            <hr className="bc-my-4 bc-border-0 bc-border-t bc-border-solid bc-border-line" />

            <div className="bc-flex bc-flex-col bc-gap-2">
              {joined && (
                <MetaLine icon={<LuCake size={14} />}>
                  {__('Joined')} {joined}
                </MetaLine>
              )}
              {profile?.last_active_at && (
                <MetaLine icon={<LuClock3 size={14} />}>
                  {__('Last active')} {relativeTime(profile.last_active_at)}
                </MetaLine>
              )}
              {SOCIAL_LINK_KEYS.filter(key => profile?.social_links?.[key]).map(key => (
                <MetaLine icon={LINK_ICONS[key]} key={key}>
                  <a
                    className="bc-truncate bc-text-primary hover:bc-underline"
                    href={profile?.social_links[key]}
                    // Untrusted destinations a member typed in: noopener stops
                    // the target reaching back through window.opener, and
                    // nofollow keeps the profile from passing them ranking.
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                  >
                    {displayUrl(profile?.social_links[key])}
                  </a>
                </MetaLine>
              ))}
            </div>

            {onManage && (
              <button
                className="bc-mt-4 bc-flex bc-w-full bc-cursor-pointer bc-items-center bc-justify-center bc-gap-2 bc-rounded-full bc-border bc-border-solid bc-border-line-strong bc-bg-surface bc-py-1.5 bc-text-[13px] bc-font-medium bc-text-ink bc-transition-colors hover:bc-bg-surface-sunken"
                onClick={onManage}
                type="button"
              >
                <LuSettings size={14} />
                {__('Manage profile')}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}
