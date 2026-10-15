import { cn } from '@common/helpers/globalHelpers'
import { Dropdown } from 'antd'
import { LuChevronDown } from 'react-icons/lu'
import { useNavigate } from 'react-router'

export interface Choice {
  isSelected: boolean
  label: string
  to: string
}

// The type strip's chip (see topic-type-filter), outlined: the two rows sit
// together and read as one set. Not its selected blue — this names where the
// reader is, it is not a filter they switched on.
export const CHIP_CLASS = cn([
  // touch-target: 40px under a finger (global.css), 32px under a mouse.
  'touch-target bc-flex bc-h-8 bc-min-w-0 bc-max-w-[60%] bc-shrink bc-items-center bc-gap-1 bc-rounded-md bc-px-3',
  'bc-border bc-border-solid bc-border-line bc-bg-surface bc-text-sm bc-text-ink'
])

/**
 * One part of what the listing shows — the stage, say — as a picker: the chip
 * names the current choice and opens the others. Each choice is a link, so
 * picking one navigates to the listing it names rather than filtering in place.
 *
 * @param title what the choices are, shown before the current one from lg and
 *              in its place while none is selected
 * @param alwaysTitled show the title at every width — for a row of pickers
 *              whose choices share labels ("All"), which say nothing bare
 */
export default function ChoiceChip({
  alwaysTitled = false,
  choices,
  title
}: {
  alwaysTitled?: boolean
  choices: Choice[]
  title: string
}) {
  const navigate = useNavigate()
  const selected = choices.find(choice => choice.isSelected)

  return (
    <Dropdown
      menu={{
        items: choices.map(choice => ({ key: choice.to, label: choice.label })),
        onClick: ({ key }) => navigate(key),
        selectable: true,
        selectedKeys: selected ? [selected.to] : []
      }}
      trigger={['click']}
    >
      <button
        aria-label={selected ? `${title}: ${selected.label}` : title}
        className={cn([
          CHIP_CLASS,
          'bc-cursor-pointer bc-transition-colors hover:bc-border-line-strong lg:bc-h-10 lg:bc-max-w-none lg:bc-px-3.5',
          'bc-outline-none focus-visible:bc-ring-2 focus-visible:bc-ring-primary/40'
        ])}
        type="button"
      >
        {selected && (
          <span className={cn(['bc-shrink-0 bc-text-ink-muted', alwaysTitled ? 'bc-inline' : 'bc-hidden lg:bc-inline'])}>
            {title}:
          </span>
        )}
        <span className="bc-min-w-0 bc-truncate lg:bc-font-medium">{selected?.label ?? title}</span>
        <LuChevronDown aria-hidden className="bc-shrink-0 bc-text-ink-muted" size={14} />
      </button>
    </Dropdown>
  )
}
