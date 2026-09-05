import { __, sprintf } from '@common/helpers/i18nWrap'
import { Tooltip } from 'antd'
import { type CSSProperties } from 'react'
import { LuForward } from 'react-icons/lu'

import { buildShareUrl, PRIMARY_SHARE_CHANNELS } from '../shared/share-targets'
import useShareStore from '../state/use-share-store'
import styles from './share-row.module.css'

interface ShareRowProps {
  className?: string
  topicSlug: string
  topicTitle: string
  /** `panel` fills a rail card's width; `inline` stays a compact group. */
  variant?: 'inline' | 'panel'
}

/**
 * Where this topic can be sent, offered in the page itself.
 *
 * Replaces the share icon that used to sit in the topic's title row. A single
 * glyph there asked the reader to open a dialog before they could see whether
 * the forum could even reach the place they wanted to send it; the destinations
 * themselves are the affordance, and they cost one anchor each.
 *
 * The four most-used networks are here and the rest — Reddit, Telegram, email,
 * the copy field and the operating system's own share sheet — stay behind the
 * trailing arrow, which opens the same dialog as before.
 */
export default function ShareRow({
  className,
  topicSlug,
  topicTitle,
  variant = 'inline'
}: ShareRowProps) {
  const { open } = useShareStore()
  const url = buildShareUrl(topicSlug)

  const rowClass = [styles.row, variant === 'panel' ? styles.spread : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rowClass}>
      {PRIMARY_SHARE_CHANNELS.map(channel => {
        const Icon = channel.icon

        return (
          <Tooltip key={channel.key} title={channel.label}>
            <a
              // The label names the destination rather than repeating "Share":
              // four links reading the same thing is four identical stops in a
              // screen reader's link list.
              aria-label={sprintf(__('Share on %s'), channel.label)}
              className={styles.channel}
              href={channel.href(url, topicTitle)}
              // `noopener` is what matters — a share window opened with
              // `window.opener` live can navigate this tab out from under the
              // reader. `noreferrer` goes with it so the network is not handed
              // the referring URL before anyone has agreed to share it.
              rel="noopener noreferrer"
              style={
                {
                  '--share-brand': channel.brand,
                  '--share-brand-dark': channel.brandDark ?? channel.brand
                } as CSSProperties
              }
              target="_blank"
            >
              <Icon size={18} />
            </a>
          </Tooltip>
        )
      })}

      <Tooltip title={__('More sharing options')}>
        <button
          aria-label={__('More sharing options')}
          className={styles.channel}
          onClick={() => open({ title: topicTitle, type: 'topic', url })}
          type="button"
        >
          <LuForward size={19} />
        </button>
      </Tooltip>
    </div>
  )
}
