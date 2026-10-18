import { __, sprintf } from '@common/helpers/i18nWrap'
import { useState } from 'react'
import { LuPlay } from 'react-icons/lu'

import { type VideoLink } from '../shared/video-link'
import styles from './video-embed.module.css'

const PROVIDER_NAMES = { vimeo: 'Vimeo', youtube: 'YouTube' } as const

interface VideoEmbedProps {
  /** The address as the member wrote it, kept as a way out to the video's own page. */
  address: string
  video: VideoLink
}

/**
 * A video linked in a post, played in place.
 *
 * Nothing is fetched from the video host until the reader asks for it: until
 * then this is a plain button drawn by the portal, with no thumbnail, because
 * a thumbnail is itself a request to the host. The portal otherwise contacts
 * no third party — it even ships its own font for that reason — so a reader
 * who never presses play never has YouTube or Vimeo told they visited.
 */
export default function VideoEmbed({ address, video }: VideoEmbedProps) {
  const [playing, setPlaying] = useState(false)
  const provider = PROVIDER_NAMES[video.provider]

  if (playing) {
    return (
      <div className={styles.frame}>
        <iframe
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          src={video.embedUrl}
          title={sprintf(__('%s video player'), provider)}
        />
      </div>
    )
  }

  return (
    <div className={styles.frame}>
      <button className={styles.poster} onClick={() => setPlaying(true)} type="button">
        <span aria-hidden="true" className={styles.play}>
          <LuPlay size={26} />
        </span>
        <span className={styles.label}>{sprintf(__('Play %s video'), provider)}</span>
        <span className={styles.note}>{sprintf(__('Loads the player from %s'), provider)}</span>
      </button>
      <a className={styles.source} href={address} rel="noopener noreferrer nofollow ugc" target="_blank">
        {sprintf(__('Open on %s'), provider)}
      </a>
    </div>
  )
}
