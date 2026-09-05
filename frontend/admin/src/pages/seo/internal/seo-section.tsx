import { Switch, Typography } from 'antd'

const { Text, Title } = Typography

interface SeoToggle {
  description: string
  disabled?: boolean
  key: string
  label: string
  value: boolean
}

interface SeoSectionProps {
  children?: React.ReactNode
  disabled?: boolean
  onChange?: (key: string, value: boolean) => void
  subtitle: string
  title: string
  toggles?: SeoToggle[]
}

/**
 * A titled card of SEO controls.
 *
 * Takes a list of switches and/or arbitrary children, because these settings are
 * not uniformly boolean — meta ownership is a choice of three and the server
 * list size is a number.
 */
export default function SeoSection({
  children,
  disabled = false,
  onChange,
  subtitle,
  title,
  toggles = []
}: SeoSectionProps) {
  return (
    <div className="bc-mb-6 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-6">
      <div className="bc-mb-4">
        <Title className="bc-mb-1" level={4}>
          {title}
        </Title>
        <Text type="secondary">{subtitle}</Text>
      </div>

      {toggles.length > 0 && (
        <div className="bc-grid bc-grid-cols-1 bc-gap-4 md:bc-grid-cols-3">
          {toggles.map(toggle => (
            <div
              className="bc-flex bc-flex-1 bc-flex-col bc-justify-between bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4"
              key={toggle.key}
            >
              <div className="bc-mb-4 bc-flex bc-items-center bc-justify-between bc-gap-2">
                <Text strong>{toggle.label}</Text>
                <Switch
                  checked={toggle.value}
                  disabled={disabled || toggle.disabled}
                  onChange={checked => onChange?.(toggle.key, checked)}
                />
              </div>
              <Text className="bc-text-sm" type="secondary">
                {toggle.description}
              </Text>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  )
}
