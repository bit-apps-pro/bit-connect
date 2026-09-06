import { __ } from '@common/helpers/i18nWrap'
import ContentBox from '@pages/Post/ContentBox'
import { LuArrowBigUp, LuMessageSquare } from 'react-icons/lu'
import { Link } from 'react-router'

import { relativeTime } from '@/utils/utils'

import { type UserComment } from '../data/use-user-content'

/**
 * One comment on a profile, shown as "reply to <topic>" plus the body.
 *
 * The topic title leads because a comment out of context is close to
 * meaningless — the reader needs to know what was being replied to before the
 * reply itself is worth reading.
 */
export default function CommentRow({ comment }: { comment: UserComment }) {
  return (
    <article className="bc-border-0 bc-border-b bc-border-solid bc-border-line bc-px-4 bc-py-3 last:bc-border-b-0 hover:bc-bg-surface-sunken sm:bc-px-5">
      <div className="bc-mb-1 bc-flex bc-min-w-0 bc-items-center bc-gap-2 bc-text-[12px] bc-text-ink-subtle">
        <LuMessageSquare className="bc-shrink-0" size={13} />
        <span className="bc-shrink-0">{__('replied to')}</span>
        <Link
          className="bc-truncate bc-font-medium bc-text-primary bc-no-underline hover:bc-underline"
          to={`/${comment.post_name}`}
        >
          {comment.post_title}
        </Link>
      </div>

      <div className="bc-text-[14px] bc-leading-[1.5] bc-text-ink">
        <ContentBox compact content={comment.comment_content} />
      </div>

      <div className="bc-mt-1.5 bc-flex bc-items-center bc-gap-3 bc-text-[12px] bc-text-ink-subtle">
        <span>{relativeTime(comment.comment_date_gmt)}</span>
        {(comment.vote?.total ?? 0) > 0 && (
          <span className="bc-flex bc-items-center bc-gap-1">
            <LuArrowBigUp size={14} />
            {comment.vote?.total}
          </span>
        )}
      </div>
    </article>
  )
}
