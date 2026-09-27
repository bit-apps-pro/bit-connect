import { cn } from '@common/helpers/globalHelpers'
import { Typography } from 'antd'
import { LuCheck } from 'react-icons/lu'

const { Text } = Typography

interface ChoiceCardProps {
  checked: boolean
  description: string
  disabled?: boolean
  label: string
  /** Shared by every card in one choice, so the browser treats them as one group. */
  name: string
  onSelect: (value: string) => void
  value: string
}

/**
 * One option in a small set of choices, where the whole card is the label.
 *
 * A real radio input sits under it, visually hidden: the cards sharing a
 * `name` are one group to the browser, so they take a single tab stop and the
 * arrow keys move between them, with nothing reimplemented here. The marker is
 * drawn instead — a filled square with a check — and the card shows the focus
 * ring the hidden input cannot.
 */
export default function ChoiceCard({
  checked,
  description,
  disabled = false,
  label,
  name,
  onSelect,
  value
}: ChoiceCardProps) {
  return (
    <label
      className={cn([
        'bc-flex bc-w-60 bc-max-w-full bc-gap-2.5 bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-3 bc-transition-colors',
        'has-[:focus-visible]:bc-ring-2 has-[:focus-visible]:bc-ring-primary/50',
        disabled ? 'bc-cursor-not-allowed bc-opacity-60' : 'bc-cursor-pointer hover:bc-border-line-strong'
      ])}
    >
      <input
        checked={checked}
        className="bc-sr-only"
        disabled={disabled}
        name={name}
        onChange={() => onSelect(value)}
        type="radio"
        value={value}
      />
      <span
        aria-hidden
        className={cn([
          'bc-mt-px bc-flex bc-size-4 bc-shrink-0 bc-items-center bc-justify-center bc-rounded-[4px] bc-border bc-border-solid bc-transition-colors',
          checked ? 'bc-border-primary bc-bg-primary bc-text-white' : 'bc-border-line-strong bc-bg-surface'
        ])}
      >
        {checked && <LuCheck size={12} strokeWidth={3} />}
      </span>
      <span className="bc-min-w-0">
        <span className="bc-block bc-text-sm bc-font-medium bc-text-ink">{label}</span>
        <Text className="bc-mt-1 bc-block bc-text-xs" type="secondary">
          {description}
        </Text>
      </span>
    </label>
  )
}
