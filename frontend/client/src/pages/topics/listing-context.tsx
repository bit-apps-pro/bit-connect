import { __ } from '@common/helpers/i18nWrap'
import useActiveStage from '@pages/Layout/data/use-active-stage'
import { useStagesStore } from '@pages/Layout/data/use-stages'
import { listingLink } from '@pages/Layout/ui/Sidebar/listing-link'

import useListingSelection from '../Layout/data/use-listing-selection'
import ChoiceChip, { CHIP_CLASS, type Choice } from './choice-chip'
import ListingContextExtras from './listing-context-extras'

/**
 * What the list is showing, as a row of chips — "In Progress ⌄" — on phones,
 * where the sidebar that says so is folded into the drawer. The chips only name
 * the current position; switching it is the drawer's navigation.
 *
 * Hidden from md, where the sidebar is always shown.
 *
 * @param archiveName the term a tag, type or status archive is listing. That
 *                    archive spans every stage, so it is named on its own
 *                    rather than offering choices that would leave it.
 */
export default function ListingContext({ archiveName = '' }: { archiveName?: string }) {
  const { scope } = useListingSelection()
  const activeStage = useActiveStage()
  const { stages } = useStagesStore()

  if (archiveName) {
    return (
      <div className="bc-flex md:bc-hidden">
        <span className={CHIP_CLASS}>
          <span className="bc-min-w-0 bc-truncate">{archiveName}</span>
        </span>
      </div>
    )
  }

  // One stage at a time, scoped or not: the root is the default stage's, and so
  // is the archive the listing is scoped to, so there is no "every stage" row.
  const stageChoices: Choice[] = stages.map(stage => ({
    isSelected: stage.slug === activeStage,
    label: stage.name,
    to: listingLink({ scope, stage: stage.slug })
  }))

  return (
    <div className="bc-flex bc-min-w-0 bc-items-center bc-gap-2 md:bc-hidden">
      {ListingContextExtras && <ListingContextExtras />}
      <ChoiceChip choices={stageChoices} title={__('Stages')} />
    </div>
  )
}
