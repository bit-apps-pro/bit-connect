import { FollowButton } from '@features/notifications'
import { type TaxonomyTerm } from '@features/topic-modal/data/use-taxonomies'
import { tagLabel } from '@utilities/tag-filter'

import { type PortalArchive } from '@/config/config'

/**
 * What a term archive is, above its list: the term's name, what the admin
 * wrote about it, and Follow where the term can be followed.
 *
 * The name is the page's h1 from md up. Below that the phone's listing context
 * already names the archive in its chip row, so repeating it here would put
 * the same word twice in two lines.
 *
 * Nothing until the term is known: the follow control needs its id, and a
 * heading that appeared a beat after the list would shove the list down.
 */
export default function ArchiveHeader({ archive, term }: { archive: PortalArchive; term: TaxonomyTerm | undefined }) {
  if (!term) return

  return (
    <div className="bc-flex bc-items-start bc-justify-between bc-gap-3">
      <div className="bc-min-w-0">
        <h1 className="bc-m-0 bc-hidden bc-text-[21px] bc-font-medium bc-leading-tight bc-text-ink md:bc-block">
          {/* A tag is written the way it appears on every topic. */}
          {archive.filter === 'tags' ? tagLabel(term.name) : term.name}
        </h1>
        {term.description !== '' && (
          <p className="bc-m-0 bc-text-[14px] bc-leading-snug bc-text-ink-muted md:bc-mt-1">{term.description}</p>
        )}
      </div>
      {archive.follow !== '' && (
        <FollowButton
          className="bc-shrink-0"
          kind={archive.label}
          subject={term.name}
          targetId={term.id}
          targetType={archive.follow}
        />
      )}
    </div>
  )
}
