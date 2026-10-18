import { Typography } from 'antd'

const { Text, Title } = Typography

interface SeoSectionProps {
  children?: React.ReactNode
  subtitle?: string
  title: string
}

/**
 * A titled card of SEO controls. The controls themselves are SeoFieldRows, so
 * every setting on the screen reads as one row in the same list shape.
 *
 * Drawn to the same measure as the Notifications cards, so the settings
 * screens read as one family.
 */
export default function SeoSection({ children, subtitle, title }: SeoSectionProps) {
  return (
    <div className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-py-5">
      <div className="bc-mb-4 bc-min-w-0">
        <Title className="bc-mb-1" level={4}>
          {title}
        </Title>
        {subtitle && (
          <Text className="bc-block bc-text-xs" type="secondary">
            {subtitle}
          </Text>
        )}
      </div>

      {children}
    </div>
  )
}
