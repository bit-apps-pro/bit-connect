import { Switch, Typography } from 'antd'

const { Text, Title } = Typography

interface SettingItem {
  description: string
  key: string
  label: string
  value: boolean
}

interface SettingsSectionProps {
  disabled?: boolean
  onChange: (key: string, value: boolean) => void
  settings: SettingItem[]
  subtitle: string
  title: string
}

export default function SettingsSection({
  disabled = false,
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
    </div>
  )
}
