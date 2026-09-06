import { Typography } from 'antd'

const { Text, Title } = Typography

interface SectionCardProps {
  children: React.ReactNode
  /** Sits opposite the title — a status tag, a shortcut button. */
  extra?: React.ReactNode
  subtitle?: React.ReactNode
  title: string
}

/**
 * One titled group of settings.
 *
 * Rules between rows come from the rows themselves (each draws one above it),
 * not from a `divide-*` class on this container: preflight is off in this app,
 * so `divide-solid` gives every child a solid border on all four sides at the
 * browser's default width, and the rows end up in boxes.
 */
export default function SectionCard({ children, extra, subtitle, title }: SectionCardProps) {
  return (
    <div className="bc-mb-6 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-pb-2 bc-pt-5">
      <div className="bc-mb-1 bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-3">
        <div className="bc-min-w-0">
          <Title className="bc-mb-1" level={4}>
            {title}
          </Title>
          {subtitle && <Text type="secondary">{subtitle}</Text>}
        </div>
        {extra && <div className="bc-shrink-0">{extra}</div>}
      </div>

      <div>{children}</div>
    </div>
  )
}
