import { __ } from '@common/helpers/i18nWrap'
import { type Topic } from '@features/topic-modal/shared/type'
import { Skeleton } from 'antd'
import { LuMessageCircle } from 'react-icons/lu'
import { Link } from 'react-router'

import { relativeTime } from '@/utils/utils'

import useRelatedTopics from '../data/use-related-topics'
import { PANEL, PANEL_TITLE } from './panel-styles'

/**
 * "More like this" list. Rendered twice — in the desktop rail and, on narrow
 * screens, inline under the comments — but TanStack Query dedupes by key, so
 * both instances share one request.
 */
export default function RelatedTopics({
  className = '',
  topic
}: {
  className?: string
  topic: Topic | undefined
}) {
  const { isLoadingRelated, relatedTopics } = useRelatedTopics(topic)

  // No taxonomy to relate on, or nothing else shares it: show nothing rather
  // than an empty box.
  if (!isLoadingRelated && relatedTopics.length === 0) return

  return (
    <section aria-label={__('Related topics')} className={`${PANEL} ${className}`}>
      <h3 className={PANEL_TITLE}>{__('Related topics')}</h3>

      {isLoadingRelated ? (
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      ) : (
        <ul className="bc-m-0 bc-flex bc-list-none bc-flex-col bc-p-0">
          {relatedTopics.map(related => (
            <li key={related.ID}>
              {/* Negative margin pulls the hover surface out to the card edges,
                  so the whole row highlights rather than just the text. */}
              <Link
                className="bc--mx-2 bc-block bc-rounded-lg bc-px-2 bc-py-2 bc-no-underline bc-transition-colors hover:bc-bg-surface-sunken"
                to={`/${related.post_name}`}
              >
                <span className="bc-line-clamp-2 bc-block bc-text-[13px] bc-font-medium bc-leading-[1.35] bc-text-ink">
                  {related.post_title}
                </span>
                <span className="bc-mt-1 bc-flex bc-items-center bc-gap-2 bc-text-[11px] bc-text-ink-subtle">
                  <span>{relativeTime(related.post_date_gmt)}</span>
                  <span className="bc-text-line-strong">·</span>
                  <span className="bc-flex bc-items-center bc-gap-1">
                    <LuMessageCircle size={12} />
                    {related.comments_count ?? 0}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
