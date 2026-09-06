import { __ } from '@common/helpers/i18nWrap'
import { Button } from 'antd'
import { LuForward } from 'react-icons/lu'

import { buildShareUrl } from '../shared/share-targets'
import useShareStore from '../state/use-share-store'

interface ShareButtonProps {
  /** Passed through so the caller's own action-row styling still applies. */
  className?: string
  /** Present for a reply; absent shares the topic itself. */
  commentId?: number
  topicSlug: string
  topicTitle: string
}

/**
 * Opens the page's share dialog for one reply, from that reply's action row.
 *
 * The link is built here rather than in the dialog because only the caller
 * knows what it is offering to share, and building it up front means the
 * dialog never has to be told which of the two kinds it is holding twice.
 *
 * The glyph is the forward arrow the topic's own share row ends with, not the
 * node-and-branches share mark it used to carry: a reader who has just met the
 * arrow beside the topic meets the same arrow on every reply under it.
 */
export default function ShareButton({ className, commentId, topicSlug, topicTitle }: ShareButtonProps) {
  const { open } = useShareStore()

  const handleClick = () =>
    open({
      title: topicTitle,
      type: commentId ? 'comment' : 'topic',
      url: buildShareUrl(topicSlug, commentId)
    })

  return (
    <Button
      className={className}
      icon={<LuForward style={{ fontSize: '13px' }} />}
      onClick={handleClick}
      size="small"
      type="text"
    >
      {__('Share')}
    </Button>
  )
}
