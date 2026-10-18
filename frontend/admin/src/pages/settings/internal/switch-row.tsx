import { Switch, Typography } from 'antd'

const { Text } = Typography

interface SwitchRowProps {
  checked: boolean
  description: string
  disabled?: boolean
  label: string
  loading?: boolean
  onChange: (checked: boolean) => void
}

/**
 * One on/off setting: its name and switch on one line, what it does beneath.
 */
export default function SwitchRow({
  checked,
  description,
  disabled = false,
  label,
  loading = false,
  onChange
}: SwitchRowProps) {
  return (
    <div className="bc-rounded-md bc-border bc-border-solid bc-border-line bc-px-4 bc-py-3.5">
      <div className="bc-flex bc-items-center bc-justify-between bc-gap-4">
        <Text className="bc-text-sm bc-font-medium bc-text-ink">{label}</Text>
        <Switch
          aria-label={label}
          checked={checked}
          disabled={disabled}
          loading={loading}
          onChange={onChange}
        />
      </div>
      <Text className="bc-mt-1.5 bc-block bc-text-sm" type="secondary">
        {description}
      </Text>
    </div>
  )
}
