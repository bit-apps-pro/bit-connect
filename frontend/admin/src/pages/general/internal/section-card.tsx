import { Typography } from 'antd'

const { Text, Title } = Typography

interface SectionCardProps {
  children: React.ReactNode
  /** Sits opposite the title — a status tag, a shortcut button. */
  extra?: React.ReactNode
  subtitle?: React.ReactNode
  /** Sits right beside the title — a short status that qualifies it. */
  tag?: React.ReactNode
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
export default function SectionCard({ children, extra, subtitle, tag, title }: SectionCardProps) {
  return (
    <div className="bc-mb-5 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-5 bc-pb-1 bc-pt-4">
      <div className="bc-mb-4 bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-3">
        <div className="bc-min-w-0">
          <div className="bc-mb-0.5 bc-flex bc-flex-wrap bc-items-center bc-gap-2">
            <Title className="bc-m-0" level={5}>
              {title}
            </Title>
            {tag}
          </div>
          {subtitle && (
            <Text className="bc-text-xs" type="secondary">
              {subtitle}
            </Text>
          )}
        </div>
        {extra && <div className="bc-shrink-0">{extra}</div>}
      </div>

      <div>{children}</div>
    </div>
  )
}
