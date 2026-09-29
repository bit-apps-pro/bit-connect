import { cn } from '@common/helpers/globalHelpers'
import { __, sprintf } from '@common/helpers/i18nWrap'
import useActiveStage from '@pages/Layout/data/use-active-stage'
import useListingSelection from '@pages/Layout/data/use-listing-selection'
import { useStagesStore } from '@pages/Layout/data/use-stages'
import { listingLink } from '@pages/Layout/ui/Sidebar/listing-link'
import { Drawer } from 'antd'
import { useState } from 'react'
import { LuCheck, LuChevronDown } from 'react-icons/lu'
import { Link } from 'react-router'

import config from '@/config/config'
import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

interface Choice {
  isSelected: boolean
  label: string
  to: string
}

const CHIP_CLASS = cn([
  'bc-flex bc-h-8 bc-min-w-0 bc-max-w-[60%] bc-shrink bc-cursor-pointer bc-items-center bc-gap-1 bc-rounded-full bc-border-none bc-px-3',
  'bc-bg-surface-raised bc-text-[13px] bc-font-semibold bc-text-ink',
  'bc-transition-colors bc-duration-200 bc-ease-out hover:bc-bg-surface-hover active:bc-scale-95'
])

/**
 * A chip naming one half of the listing — the department or the stage — that
 * opens a bottom sheet of the others to switch to. Each row is the link the
 * sidebar would give for it, so the sheet and the drawer never disagree.
 */
function ChoiceChip({ choices, title }: { choices: Choice[]; title: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const current = choices.find(choice => choice.isSelected)?.label ?? title

  return (
    <>
      <button aria-haspopup="dialog" className={CHIP_CLASS} onClick={() => setIsOpen(true)} type="button">
        <span className="bc-min-w-0 bc-truncate">{current}</span>
        <LuChevronDown aria-hidden className="bc-shrink-0 bc-text-ink-subtle" size={14} strokeWidth={2.5} />
      </button>

      <Drawer
        height="auto"
        onClose={() => setIsOpen(false)}
        open={isOpen}
        placement="bottom"
        styles={{
          body: { maxHeight: '70dvh', overflowY: 'auto', padding: 8 },
          content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 }
        }}
        title={title}
      >
        <nav className="bc-flex bc-flex-col">
          {choices.map(choice => (
            <Link
              aria-current={choice.isSelected ? 'page' : undefined}
              className={cn([
                'bc-flex bc-h-12 bc-items-center bc-justify-between bc-gap-3 bc-rounded-lg bc-px-3 bc-text-base bc-no-underline',
                'hover:bc-bg-surface-sunken',
                choice.isSelected ? 'bc-font-semibold bc-text-primary' : 'bc-text-ink'
              ])}
              key={choice.to}
              onClick={() => setIsOpen(false)}
              to={choice.to}
            >
              <span className="bc-min-w-0 bc-truncate">{choice.label}</span>
              {choice.isSelected && <LuCheck aria-hidden className="bc-shrink-0" size={18} />}
            </Link>
          ))}
        </nav>
      </Drawer>
    </>
  )
}

/**
 * What the list is showing, as a row of chips — "Mobile App ⌄  In Progress ⌄" —
 * on phones, where the sidebar that says so is folded into the drawer. Each
 * chip opens a sheet to switch that half without leaving the list.
 *
 * Hidden from md, where the sidebar is always shown.
 *
 * @param archiveName the term a tag, type or status archive is listing. That
 *                    archive spans every stage and department, so it is named
 *                    on its own rather than offering choices that would leave it.
 */
export default function ListingContext({ archiveName = '' }: { archiveName?: string }) {
  const { department, stage: namedStage } = useListingSelection()
  const activeStage = useActiveStage()
  const { stages } = useStagesStore()
  const departments = useTaxonomiesStoreSelect()?.['bit-connect-departments'] || []
  const showDepartments = config.PORTAL_FILTERS.product && departments.length > 0

  if (archiveName) {
    return (
      <div className="bc-flex md:bc-hidden">
        <span className={cn([CHIP_CLASS, 'bc-cursor-default active:bc-scale-100'])}>
          <span className="bc-min-w-0 bc-truncate">{archiveName}</span>
        </span>
      </div>
    )
  }

  const allDepartments = sprintf(
    // translators: %s: what the portal calls its departments, plural.
    __('All %s'),
    config.DEPARTMENT_NAMING.plural
  )

  const departmentChoices: Choice[] = [
    { isSelected: department === '', label: allDepartments, to: listingLink({ stage: namedStage }) },
    ...departments.map(term => ({
      isSelected: term.slug === department,
      label: term.name,
      to: listingLink({ department: term.slug, stage: namedStage })
    }))
  ]

  // Every stage at once is a listing only inside a department — the root is
  // the default stage's — so that row is offered only there.
  const stageChoices: Choice[] = [
    ...(department === ''
      ? []
      : [{ isSelected: activeStage === undefined, label: __('All stages'), to: listingLink({ department }) }]),
    ...stages.map(stage => ({
      isSelected: stage.slug === activeStage,
      label: stage.name,
      to: listingLink({ department, stage: stage.slug })
    }))
  ]

  return (
    <div className="bc-flex bc-min-w-0 bc-items-center bc-gap-2 md:bc-hidden">
      {showDepartments && <ChoiceChip choices={departmentChoices} title={config.DEPARTMENT_NAMING.plural} />}
      <ChoiceChip choices={stageChoices} title={__('Stages')} />
    </div>
  )
}
