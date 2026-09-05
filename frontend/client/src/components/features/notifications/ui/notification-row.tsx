import { cn } from '@common/helpers/globalHelpers'
import { __, sprintf } from '@common/helpers/i18nWrap'
import { Avatar } from 'antd'

import { type NotificationItem } from '../data/use-notifications'
import appearanceFor from '../shared/appearance'

/**
 * One line of the bell, and of the full list.
 *
 * Every word comes from `context`, which the server stored when the event
 * happened rather than looking up now. That is what lets the most important
 * notification the forum sends — your content was removed — still read as a
 * sentence after the thing it is about has gone.
 *
 * The layout is avatar-plus-badge because a feed of identical avatars and
 * sentences has to be *read* to be scanned. The badge lets a reader find the
 * reply among the upvotes by shape and colour before reading a word, which is
 * the whole reason every mature notification list looks like this.
 */

/** "3m", "5h", "2d" — short enough to sit in a metadata line. */
function shortAgo(iso: string): string {
  const then = Date.parse(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'))
  if (Number.isNaN(then)) return ''

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 60) return __('now')
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d`

  return `${Math.floor(seconds / 604_800)}w`
}

/**
 * The sentence for one row, with the actor's name picked out.
 *
 * Returns a node rather than a string so the name can carry weight inside the
 * sentence — the one word a reader scans for is the person, and a uniformly
 * grey line makes them read the whole thing to find it.
 *
 * Mirrors NotificationMailer::sentence() on the server. Two copies of the
 * wording is a real cost, but the alternative is the server sending rendered
 * prose the client cannot restyle or translate in the reader's locale — and the
 * mail has to work with no client at all.
 */
function describe(item: NotificationItem) {
  const who = item.actor.is_system ? __('The forum') : item.actor.name || __('Someone')
  const title = item.context.topic_title
  const named = title ? `"${title}"` : __('a topic')

  const name = <span className="bc-font-semibold bc-text-ink">{who}</span>
  const subject = <span className="bc-font-medium bc-text-ink">{named}</span>

  switch (item.type) {
    case 'badge_awarded': {
      return (
        <>
          {__('You were given the')}{' '}
          <span className="bc-font-semibold bc-text-ink">{item.context.badge_label ?? ''}</span>{' '}
          {__('badge')}
        </>
      )
    }
    case 'comment_reply': {
      return (
        <>
          {name} {__('replied to you in')} {subject}
        </>
      )
    }
    case 'content_actioned': {
      return <>{__('Something you wrote was removed after review')}</>
    }
    case 'mention': {
      return (
        <>
          {name} {__('mentioned you in')} {subject}
        </>
      )
    }
    case 'report_filed': {
      return <>{__('A new report is waiting in the moderation queue')}</>
    }
    case 'report_resolved': {
      return (
        <>
          {__('A moderator reviewed something you reported')}
          {item.context.decision_label ? ` — ${item.context.decision_label}` : ''}
        </>
      )
    }
    case 'topic_new': {
      return (
        <>
          {name} {__('posted a new topic:')} {subject}
        </>
      )
    }
    case 'topic_reply': {
      return (
        <>
          {name} {__('commented on')} {subject}
        </>
      )
    }
    case 'topic_status_changed': {
      return (
        <>
          {__('The status changed on')} {subject}
        </>
      )
    }
    case 'vote_received': {
      // A collapsed row speaks for several people. Naming the last voter would
      // credit one person with everyone else's votes.
      return item.count > 1 ? (
        <>
          <span className="bc-font-semibold bc-text-ink">{sprintf(__('%d people'), item.count)}</span>{' '}
          {__('upvoted your post in')} {subject}
        </>
      ) : (
        <>
          {name} {__('upvoted your post in')} {subject}
        </>
      )
    }
    default: {
      return <>{item.type_label}</>
    }
  }
}

interface NotificationRowProps {
  item: NotificationItem
  onSelect: (item: NotificationItem) => void
  /**
   * `card` matches the topic cards the rest of the portal is built from — its
   * own border, its own radius, a gap to its neighbours. `flat` is for the
   * bell's dropdown, where a stack of bordered cards inside an already-bordered
   * panel would be a box in a box in a box.
   */
  variant?: 'card' | 'flat'
}

export default function NotificationRow({ item, onSelect, variant = 'flat' }: NotificationRowProps) {
  const excerpt = item.context.excerpt?.trim()
  const { bg, fg, Icon } = appearanceFor(item.type)
  const initial = (item.actor.name || '?').charAt(0).toUpperCase()
  const isCard = variant === 'card'

  return (
    <button
      className={cn([
        'bc-relative bc-flex bc-w-full bc-cursor-pointer bc-items-start bc-gap-3',
        'bc-py-3 bc-pe-4 bc-ps-5 bc-text-left',
        'bc-transition-colors bc-duration-150 hover:bc-bg-surface-hover',
        // overflow-hidden is what keeps the unread rail inside the radius. The
        // rail is pinned to the leading edge, and without clipping it squares
        // off the top-left corner the card just rounded.
        isCard
          ? 'bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface lg:bc-p-4 lg:bc-ps-5'
          : 'bc-border-0 bc-bg-transparent'
      ])}
      onClick={() => onSelect(item)}
      type="button"
    >
      {/* Unread is a rail down the leading edge rather than a wash over the
          whole row. A tinted row is legible on its own and turns into a wall of
          colour the moment there are five of them — which is exactly when a
          reader most needs to tell them apart. The dot on the right says it a
          second time, so the state does not rest on colour alone. */}
      {!item.read && (
        <span
          className={cn([
            'bc-absolute bc-start-0 bc-w-[3px] bc-bg-primary',
            // Full height in a card, where the radius clips it into a coloured
            // edge. Inset in the flat list, where rails on adjacent rows would
            // otherwise meet and read as one continuous border down the panel
            // rather than a mark against each row.
            isCard ? 'bc-inset-y-0' : 'bc-inset-y-2 bc-rounded-e-full'
          ])}
        />
      )}

      <span className="bc-relative bc-shrink-0">
        {/* No person behind it, so no face and no initial. An auto-hide or a
            retention sweep is the forum acting on its own, and a "?" avatar
            invents a member who does not exist — the same reason the server
            sends `is_system` instead of an empty name. */}
        {item.actor.is_system || !item.actor.name ? (
          <span
            className={cn([
              'bc-flex bc-h-9 bc-w-9 bc-items-center bc-justify-center bc-rounded-full',
              bg,
              fg
            ])}
          >
            <Icon size={17} />
          </span>
        ) : (
          <Avatar alt={item.actor.name} size={36} src={item.actor.avatar || undefined}>
            {initial}
          </Avatar>
        )}
        {/* The badge sits on the avatar's corner and is cut out of it with a
            border in the surface colour, so it reads as in front rather than
            beside. A border, not a ring — preflight is off in this app, so the
            ring utilities have no base custom properties to build on.
            Suppressed for system rows, where the avatar is already the icon and
            a badge repeating it would be the same glyph twice. */}
        {!item.actor.is_system && item.actor.name && (
          <span
            className={cn([
              'bc-absolute -bc-bottom-1 -bc-end-1 bc-flex bc-h-[18px] bc-w-[18px] bc-items-center',
              'bc-justify-center bc-rounded-full bc-border-2 bc-border-solid bc-border-surface',
              bg
            ])}
          >
            <Icon className={fg} size={11} />
          </span>
        )}
      </span>

      <span className="bc-min-w-0 bc-flex-1">
        <span className="bc-block bc-text-sm bc-leading-snug bc-text-ink-muted">{describe(item)}</span>

        {excerpt && (
          <span className="bc-mt-1 bc-block bc-truncate bc-text-xs bc-text-ink-subtle">{excerpt}</span>
        )}

        <span className="bc-mt-1 bc-flex bc-items-center bc-gap-1.5 bc-text-xs bc-text-ink-subtle">
          <span>{shortAgo(item.created_at)}</span>
          {/* Said plainly rather than leaving a dead link to explain itself. */}
          {!item.target.exists && (
            <>
              <span aria-hidden>·</span>
              <span>{__('No longer available')}</span>
            </>
          )}
        </span>
      </span>

      {!item.read && (
        <span className="bc-mt-1.5 bc-h-2 bc-w-2 bc-shrink-0 bc-rounded-full bc-bg-primary" />
      )}
    </button>
  )
}
