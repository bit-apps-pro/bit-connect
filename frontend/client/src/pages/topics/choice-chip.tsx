import { cn } from '@common/helpers/globalHelpers'

export interface Choice {
  isSelected: boolean
  label: string
  to: string
}

// The type strip's chip (see topic-type-filter), outlined: the two rows sit
// together on a phone and read as one set. Not its selected blue — this names
// where the reader is, it is not a filter they switched on.
export const CHIP_CLASS = cn([
  'bc-flex bc-h-8 bc-min-w-0 bc-max-w-[60%] bc-shrink bc-items-center bc-gap-1 bc-rounded-md bc-px-3',
  'bc-border bc-border-solid bc-border-line bc-bg-surface bc-text-sm bc-text-ink'
])

/**
 * A chip naming one part of what the listing shows — the stage, say. It only
 * says where the visitor is: switching is the drawer's navigation, which
 * offers the same choices, so the chip doesn't open a second picker.
 */
export default function ChoiceChip({ choices, title }: { choices: Choice[]; title: string }) {
  const current = choices.find(choice => choice.isSelected)?.label ?? title

  return (
    <span className={CHIP_CLASS}>
      <span className="bc-min-w-0 bc-truncate">{current}</span>
    </span>
  )
}
