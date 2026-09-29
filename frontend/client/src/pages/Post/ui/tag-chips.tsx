import { cn } from '@common/helpers/globalHelpers'
import { type Topic } from '@features/topic-modal/shared/type'
import { tagLabel } from '@utilities/tag-filter'
import { Tag } from 'antd'
import { Link } from 'react-router'

/**
 * Neutral pill for the clickable taxonomy links. Truncated at its row's width:
 * term names are whatever the site owner typed, and one long name otherwise
 * ran out of the panel and off the page.
 */
export const CHIP =
  'bc-m-0 bc-max-w-full bc-cursor-pointer bc-truncate bc-rounded-full bc-border-0 bc-bg-surface-sunken bc-px-2.5 bc-py-0.5 bc-align-top bc-text-[12px] bc-text-ink-muted bc-transition-colors hover:bc-bg-surface-raised hover:bc-text-ink'

/** The link around a CHIP, capped so the chip inside has a width to truncate at. */
export const CHIP_LINK = 'bc-max-w-full bc-no-underline'

/**
 * Link into the listing filtered by one term of `topic`.
 *
 * The listing defaults to the "questions" stage when the URL says nothing, so a
 * bare `/?tags=x` link would filter to a stage this topic may not be in and
 * return nothing. Carrying the topic's own stage guarantees the destination
 * contains at least the topic the reader came from.
 */
export const listingLinkOf =
  (topic: Topic) =>
  (key: string, value: string): string => {
    const query = new URLSearchParams()
    const stage = topic.terms?.stages?.slug
    if (stage) query.set('stage', stage)
    query.set(key, value)

    return `/?${query.toString()}`
  }

/**
 * A topic's tags, as links into the listing filtered by each one.
 *
 * Shared by the desktop rail and the topic header so the two cannot drift: the
 * header used to print the same tags as plain secondary text, which meant the
 * one place a tag was never clickable was the phone — the only width where the
 * rail does not exist and this is the sole route to the filter.
 */
export default function TagChips({ className, topic }: { className?: string; topic: Topic }) {
  const tags = topic.terms?.tags ?? []
  const listingLink = listingLinkOf(topic)

  if (tags.length === 0) return

  return (
    <div className={cn(['bc-flex bc-flex-wrap bc-gap-1.5', className])}>
      {tags.map(tag => (
        <Link className={CHIP_LINK} key={tag.term_id} to={listingLink('tags', tag.slug)}>
          <Tag className={CHIP} title={tagLabel(tag.name)}>
            {tagLabel(tag.name)}
          </Tag>
        </Link>
      ))}
    </div>
  )
}
