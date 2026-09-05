import { __ } from '@common/helpers/i18nWrap'
import { Switch, Tag, Tooltip, Typography } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

const { Text, Title } = Typography

interface SettingItem {
  description: string
  key: string
  label: string
  /** Marks the row as a pro feature: the switch is held off and a Pro tag
      opens the upsell instead. */
  proOnly?: boolean
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
  const setBuyProOpen = useSetAtom($isBuyProModalOpen)

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
              <div className="bc-flex bc-items-center bc-justify-end bc-gap-2">
                {setting.proOnly && (
                  <Tooltip title={__('Available with Bit Connect Pro.')}>
                    <Tag
                      className="bc-m-0 bc-cursor-pointer"
                      color="gold"
                      icon={<LuCrown className="bc-mr-1 bc-inline" size={12} />}
                      onClick={() => setBuyProOpen(true)}
                    >
                      {__('Pro')}
                    </Tag>
                  </Tooltip>
                )}
                <Switch
                  // A pro row is shown switched off whatever is stored: the
                  // server reports the effective value, and letting the control
                  // look on while the feature is inert is worse than honest.
                  checked={setting.proOnly ? false : setting.value}
                  disabled={disabled || setting.proOnly}
                  onChange={checked => onChange(setting.key, checked)}
                />
              </div>
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
