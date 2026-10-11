import { __ } from '@common/helpers/i18nWrap'
import useActiveStage from '@pages/Layout/data/use-active-stage'
import { useStagesStore } from '@pages/Layout/data/use-stages'
import { ALL_STAGES, listingLink } from '@pages/Layout/ui/Sidebar/listing-link'

import useListingSelection from '../Layout/data/use-listing-selection'
import ChoiceChip, { CHIP_CLASS, type Choice } from './choice-chip'
import ListingContextExtras from './listing-context-extras'

/**
 * Where the list is, as pickers — "Stage: In Progress ⌄" — at the head of the
 * filter row. Picking one navigates to that listing.
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
      <div className="bc-flex">
        <span className={CHIP_CLASS}>
          <span className="bc-min-w-0 bc-truncate">{archiveName}</span>
        </span>
      </div>
    )
  }

  // The default stage is the listing's own until another is named; "All
  // stages" lays every stage side by side, each card badged with its own.
  const stageChoices: Choice[] = [
    {
      isSelected: activeStage === ALL_STAGES,
      label: __('All stages'),
      to: listingLink({ scope, stage: ALL_STAGES })
    },
    ...stages.map(stage => ({
      isSelected: stage.slug === activeStage,
      label: stage.name,
      to: listingLink({ scope, stage: stage.slug })
    }))
  ]

  return (
    <div className="bc-flex bc-min-w-0 bc-items-center bc-gap-2">
      {ListingContextExtras && <ListingContextExtras />}
      {stages.length > 1 && <ChoiceChip choices={stageChoices} title={__('Stage')} />}
    </div>
  )
}
