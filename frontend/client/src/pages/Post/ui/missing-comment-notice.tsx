import { __ } from '@common/helpers/i18nWrap'
import { Button } from 'antd'
import { useEffect, useRef } from 'react'
import { LuMessageSquareOff } from 'react-icons/lu'

import styles from './missing-comment-notice.module.css'

interface MissingCommentNoticeProps {
  onViewAll: () => void
}

/**
 * Where a linked-to reply would have been, when it is not there.
 *
 * Sits at the head of the thread and is scrolled to, the way the reply itself
 * would have been: the reader followed a link expecting the page to move, and
 * a notice they have to go looking for leaves them at the top of the topic
 * wondering whether the link did anything at all.
 */
export default function MissingCommentNotice({ onViewAll }: MissingCommentNoticeProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' })
  }, [])

  return (
    <div className={styles.notice} ref={ref} role="status">
      <span aria-hidden="true" className={styles.icon}>
        <LuMessageSquareOff size={16} />
      </span>
      <div className={styles.body}>
        <p className={styles.title}>{__('This comment is no longer available')}</p>
        <p className={styles.detail}>
          {__('It may have been deleted, or the link may be wrong.')}
        </p>
      </div>
      <Button className={styles.action} onClick={onViewAll} size="small">
        {__('View all comments')}
      </Button>
    </div>
  )
}
