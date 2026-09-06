import { __ } from '@common/helpers/i18nWrap'
import { ShareRow } from '@features/share'
import { type Topic } from '@features/topic-modal/shared/type'
import { Tag } from 'antd'
import { Link } from 'react-router'

import useChipProps from '@/utils/use-chip-props'

import AuthorCard from './AuthorCard'
import { PANEL, PANEL_TITLE } from './panel-styles'
import RelatedTopics from './RelatedTopics'
import TagChips, { CHIP, listingLinkOf } from './tag-chips'

/**
 * Desktop-only rail beside a topic.
 *
 * Shown from `xl` up, not `lg`: the layout already spends ~272px on the left
 * sider, so at 1024px splitting the remainder leaves the comment thread — which
 * indents four levels — too narrow to read. Hidden with CSS rather than a JS
 * breakpoint, since the portal is prerendered and a JS branch would flash.
 */
export default function PostSidebar({ topic }: { topic: Topic }) {
  const tags = topic.terms?.tags ?? []
  const topicType = topic.terms?.topic_types
  const department = topic.terms?.departments
  const { chipTagProps } = useChipProps()
  const listingLink = listingLinkOf(topic)

  return (
    <aside className="bc-hidden bc-w-[300px] bc-shrink-0 xl:bc-block">
      {/* Sticky so the rail stays with the reader through a long comment thread. */}
      <div className="bc-sticky bc-top-4 bc-flex bc-flex-col bc-gap-4">
        <AuthorCard topic={topic} />

        {/* Directly under the author, above the taxonomy: sending a topic on is
            something a reader decides early — usually while they are still
            reading it — and the rail is sticky, so from here it stays with them
            for the length of the thread. Below xl there is no rail and the same
            row runs under the topic's byline instead. */}
        <section aria-label={__('Share this topic')} className={PANEL}>
          <h3 className={PANEL_TITLE}>{__('Share on social media')}</h3>
          <ShareRow topicSlug={topic.post_name} topicTitle={topic.post_title} variant="panel" />
        </section>

        {(topicType || department || tags.length > 0) && (
          <section aria-label={__('Topic details')} className={PANEL}>
            <h3 className={PANEL_TITLE}>{__('Topic details')}</h3>

            <div className="bc-flex bc-flex-wrap bc-gap-2">
              {topicType && (
                <Tag
                  className="bc-m-0 bc-rounded-full bc-px-2.5 bc-py-0.5 bc-text-[12px]"
                  {...chipTagProps(topicType.meta?.color)}
                >
                  {topicType.name}
                </Tag>
              )}
              {department && (
                // Links into the listing filtered by this department — the
                // topics endpoint already understands these query params.
                <Link to={listingLink('product', department.slug)}>
                  <Tag className={CHIP}>{department.name}</Tag>
                </Link>
              )}
            </div>

            <TagChips className="bc-mt-3" topic={topic} />
          </section>
        )}

        <RelatedTopics topic={topic} />
      </div>
    </aside>
  )
}
