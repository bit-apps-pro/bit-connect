/* eslint-disable no-restricted-imports -- brand marks, see the note below */

/**
 * Where a topic or a single reply can be sent, and how its link is built.
 *
 * The brand marks come from Simple Icons rather than Lucide, which this project
 * otherwise uses exclusively. Lucide dropped brand icons: it has nothing for X,
 * WhatsApp, Reddit or Telegram, and its three survivors (LuFacebook, LuLinkedin,
 * LuTwitter) would cover under half this row in a visibly different drawing
 * style — with Twitter's bird standing in for a company that stopped using it.
 * A share row is expected to show the brands' own marks, so the exception the
 * import rule allows for a missing icon is taken here for all six at once.
 */
import { __ } from '@common/helpers/i18nWrap'
import { type IconType } from 'react-icons'
import { LuMail } from 'react-icons/lu'
import { SiFacebook, SiLinkedin, SiReddit, SiTelegram, SiWhatsapp, SiX } from 'react-icons/si'

import { portalUrl } from '@/utils/auth-urls'

/** What is being shared — a whole topic, or one reply inside it. */
export type ShareTargetType = 'comment' | 'topic'

export interface ShareTarget {
  /** The topic's title. Used as the shared text for both kinds. */
  title: string
  type: ShareTargetType
  /** Absolute, already carries `#comment-N` for a reply. */
  url: string
}

export interface ShareChannel {
  /** Brand colour, used for the icon on hover. Kept literal — see note below. */
  brand: string
  /**
   * What to use instead on a dark surface. Only set where the brand's own
   * colour disappears into it — X is black on white and would otherwise be a
   * black glyph on a near-black disc. Defaults to `brand`.
   */
  brandDark?: string
  /** Builds the network's share URL from the link and its title. */
  href: (url: string, title: string) => string
  icon: IconType
  key: string
  label: string
}

/**
 * Where a topic can be sent.
 *
 * Plain `https://` intent URLs rather than each network's SDK: an embedded
 * script per network is several hundred kilobytes of third-party JavaScript, a
 * consent problem in the EU, and a tracker on every page of a forum — all to
 * open a window this opens with an anchor. Nothing here loads at runtime, and
 * nothing reports back that the page was viewed.
 *
 * Brand colours are literal hex, not semantic tokens: these identify a company
 * rather than express the interface's own palette, so they must not flip with
 * the theme. Each is the brand's own value, used only for the glyph — never as
 * a fill behind text, where the contrast would be the brand's problem to solve
 * rather than ours.
 */
export const SHARE_CHANNELS: ShareChannel[] = [
  {
    brand: '#0f0f0f',
    brandDark: '#e7e9ea',
    href: (url, title) =>
      `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    icon: SiX,
    key: 'x',
    label: 'X'
  },
  {
    brand: '#1877f2',
    href: url => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    icon: SiFacebook,
    key: 'facebook',
    label: 'Facebook'
  },
  {
    brand: '#0a66c2',
    href: url => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    icon: SiLinkedin,
    key: 'linkedin',
    label: 'LinkedIn'
  },
  {
    brand: '#25d366',
    // WhatsApp takes one `text` field, so the link is appended to the title
    // rather than passed separately.
    href: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    icon: SiWhatsapp,
    key: 'whatsapp',
    label: 'WhatsApp'
  },
  {
    brand: '#ff4500',
    href: (url, title) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
    icon: SiReddit,
    key: 'reddit',
    label: 'Reddit'
  },
  {
    brand: '#26a5e4',
    href: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    icon: SiTelegram,
    key: 'telegram',
    label: 'Telegram'
  },
  {
    brand: '#6b7280',
    // `mailto:` rather than a webmail composer, so it opens whichever client the
    // reader actually uses instead of assuming Gmail.
    href: (url, title) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`,
    icon: LuMail,
    key: 'email',
    label: __('Email')
  }
]

/**
 * The four offered up front, in the row that sits in the page itself.
 *
 * The rest stay one click away in the dialog rather than being dropped: a row
 * long enough to hold all seven stops being a share affordance and becomes a
 * toolbar, and the tail of that list — Reddit, Telegram, email — is where a
 * forum link goes least often. WhatsApp keeps its place over them because on a
 * phone it is where most of the world sends a link at all.
 */
const PRIMARY_KEYS = new Set(['facebook', 'linkedin', 'whatsapp', 'x'])

/** Derived rather than a second list, so the two can never name different URLs. */
export const PRIMARY_SHARE_CHANNELS: ShareChannel[] = SHARE_CHANNELS.filter(channel =>
  PRIMARY_KEYS.has(channel.key)
)

/**
 * Absolute URL for a topic, and for a single comment inside it.
 *
 * `#comment-{id}` is WordPress's own fragment for a comment, which is what
 * `get_comment_link()` has always produced — so notification and report links
 * written before the portal answered to it resolve to the same place as one
 * copied from the Share dialog today.
 */
export const commentFragment = (commentId: number): string => `#comment-${commentId}`

/** DOM id the comment carries, so the fragment above has something to land on. */
export const commentAnchorId = (commentId: number): string => `comment-${commentId}`

/**
 * The comment a fragment names, or undefined when it names something else.
 *
 * Rejected rather than coerced when the tail is not a plain positive integer:
 * the fragment comes from whatever link was clicked, and `#comment-abc` must
 * become "no target" instead of a lookup for NaN.
 */
export function commentIdFromFragment(hash: string): number | undefined {
  const match = /^#?comment-(\d+)$/.exec(hash)
  if (!match) return undefined

  const id = Number(match[1])

  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}

/**
 * Absolute URL of a topic, or of one comment inside it.
 *
 * Built through portalUrl() rather than from window.location, so it carries the
 * portal's page basename — the part React Router hides from `pathname` and the
 * part a shared link cannot do without.
 *
 * The slug is passed through as stored: WordPress percent-encodes anything
 * outside ASCII in `post_name`, and that escaped form is what the route matches.
 */
export function buildShareUrl(topicSlug: string, commentId?: number): string {
  const base = portalUrl(`/${topicSlug}`)

  return commentId ? `${base}${commentFragment(commentId)}` : base
}

/**
 * Whether the browser can hand this off to the operating system's own share
 * sheet. Checked at call time rather than on mount: `navigator.share` throws
 * outside a secure context, and the answer never changes within a page.
 */
export const canShareNatively = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'
