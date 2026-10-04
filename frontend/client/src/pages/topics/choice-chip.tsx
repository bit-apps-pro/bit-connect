import { cn } from '@common/helpers/globalHelpers'

export interface Choice {
  isSelected: boolean
  label: string
  to: string
}

export const CHIP_CLASS = cn([
  'bc-flex bc-h-8 bc-min-w-0 bc-max-w-[60%] bc-shrink bc-items-center bc-gap-1 bc-rounded-full bc-px-3',
  'bc-bg-surface-raised bc-text-[13px] bc-font-semibold bc-text-ink'
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
