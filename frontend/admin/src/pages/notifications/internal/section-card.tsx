import { Typography } from 'antd'

const { Text, Title } = Typography

interface SectionCardProps {
  children: React.ReactNode
  subtitle?: React.ReactNode
  title: string
}

/**
 * One titled group of settings.
 *
 * A local copy of the same shape the General page uses. Not imported from
 * there: `internal/` is this codebase's signal for page-private components, and
 * reaching into another page's would make a presentational detail into a
 * cross-page contract. If a third page wants it, it belongs in a shared
 * directory — the way TabNav moved once a second page needed it.
 */
export default function SectionCard({ children, subtitle, title }: SectionCardProps) {
  return (
    <div className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-pb-5 bc-pt-5">
      <div className="bc-mb-4 bc-min-w-0">
        <Title className="bc-mb-1" level={4}>
          {title}
        </Title>
        {subtitle && <Text type="secondary">{subtitle}</Text>}
      </div>
      <div>{children}</div>
    </div>
  )
}
