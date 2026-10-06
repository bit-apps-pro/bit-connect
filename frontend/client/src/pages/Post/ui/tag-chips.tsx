import { cn } from '@common/helpers/globalHelpers'
import { __ } from '@common/helpers/i18nWrap'
import { type Topic } from '@features/topic-modal/shared/type'
import { tagLabel } from '@utilities/tag-filter'
import { archivePath } from '@utils/listing-path'
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
 * A tag a member suggested that is still awaiting review: the same pill,
 * outlined rather than filled, so it reads as provisional beside the others.
 */
export const CHIP_PENDING =
  'bc-m-0 bc-max-w-full bc-cursor-pointer bc-truncate bc-rounded-full bc-border bc-border-dashed bc-border-line bc-bg-transparent bc-px-2.5 bc-py-0.5 bc-align-top bc-text-[12px] bc-text-ink-subtle bc-transition-colors hover:bc-text-ink'

/** The pill for a tag, by whether it is still awaiting review. */
export const chipClass = (pending: boolean | undefined) => (pending ? CHIP_PENDING : CHIP)

/** What the pill says on hover: the tag, or that it is awaiting review. */
export const chipTitle = (name: string, pending: boolean | undefined) =>
  pending ? `${tagLabel(name)} — ${__('awaiting review')}` : tagLabel(name)

/**
 * A topic's tags, as links to each one's archive.
 *
 * The archive rather than the listing filtered by the tag: it is the one URL
 * the server advertises for the tag, it spans every stage, so the topic the
 * reader came from is always in it, and it is where the tag can be followed.
 * Shown as `#name`, the name as the site owner typed it — see tagLabel — and
 * the slug is what the URL carries.
 *
 * Shared by the desktop rail and the topic header so the two cannot drift: the
 * header used to print the same tags as plain secondary text, which meant the
 * one place a tag was never clickable was the phone — the only width where the
 * rail does not exist and this is the sole route to the archive.
 */
export default function TagChips({ className, topic }: { className?: string; topic: Topic }) {
  const tags = topic.terms?.tags ?? []

  if (tags.length === 0) return

  return (
    <div className={cn(['bc-flex bc-flex-wrap bc-gap-1.5', className])}>
      {tags.map(tag => (
        <Link className={CHIP_LINK} key={tag.term_id} to={archivePath('tags', tag.slug)}>
          <Tag className={chipClass(tag.pending)} title={chipTitle(tag.name, tag.pending)}>
            {tagLabel(tag.name)}
          </Tag>
        </Link>
      ))}
    </div>
  )
}
