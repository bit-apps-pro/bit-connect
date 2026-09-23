import { Switch, Typography } from 'antd'
import { type ReactNode } from 'react'

const { Text, Title } = Typography

interface SettingItem {
  description: string
  key: string
  label: string
  value: boolean
}

interface SettingsSectionProps {
  disabled?: boolean
  /** Rendered under the grid. Used to say what an edition does not have. */
  note?: ReactNode
  onChange: (key: string, value: boolean) => void
  settings: SettingItem[]
  subtitle: string
  title: string
}

/**
 * A grid of on/off settings.
 *
 * Every switch here is real: it is bound to a stored value and the forum acts
 * on it. There is deliberately no disabled variant of a row: a switch for
 * something this plugin cannot do would not be a setting. A caller that has
 * something else to put under the grid passes `note`.
 */
export default function SettingsSection({
  disabled = false,
  note,
  onChange,
  settings,
  subtitle,
  title
}: SettingsSectionProps) {
  return (
    <div className="bc-bg-surface bc-p-6 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-mb-6">
      <div className="bc-mb-4">
        <Title className="bc-mb-1" level={4}>
          {title}
        </Title>
        <Text type="secondary">{subtitle}</Text>
      </div>
      <div className="bc-grid bc-grid-cols-1 md:bc-grid-cols-3 bc-gap-4">
        {settings.map(setting => (
          <div
            className="bc-bg-surface bc-p-4 bc-rounded-md bc-border bc-border-solid bc-border-line bc-flex bc-flex-col bc-justify-between bc-flex-1"
            key={setting.key}
          >
            <div className="bc-flex bc-items-center bc-justify-between bc-mb-4">
              <Typography.Text strong>{setting.label}</Typography.Text>
              <Switch
                checked={setting.value}
                disabled={disabled}
                onChange={checked => onChange(setting.key, checked)}
              />
            </div>
            <Text className="bc-text-sm" type="secondary">
              {setting.description}
            </Text>
          </div>
        ))}
      </div>

      {/*
        Rendered bare, with no wrapper of its own. `note` is a React element and
        so always truthy — even when the component it names renders nothing — so
        wrapping it here emitted an empty spacer under the grid on every install
        whose note had nothing to say. Spacing belongs to whatever fills the
        slot, which is the only thing that knows whether it drew anything.
      */}
      {note}
    </div>
  )
}
