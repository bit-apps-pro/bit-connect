import { Typography } from 'antd'

const { Text, Title } = Typography

interface SeoSectionProps {
  children?: React.ReactNode
  subtitle: string
  title: string
}

/**
 * A titled card of SEO controls. The controls themselves are SeoFieldRows, so
 * every setting on the screen reads as one row in the same list shape.
 */
export default function SeoSection({ children, subtitle, title }: SeoSectionProps) {
  return (
    <div className="bc-mb-6 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-6">
      <div className="bc-mb-4">
        <Title className="bc-mb-1" level={4}>
          {title}
        </Title>
        <Text type="secondary">{subtitle}</Text>
      </div>

      {children}
    </div>
  )
}
