import { Typography } from 'antd'

const { Text, Title } = Typography

interface SectionCardProps {
  children?: React.ReactNode
  className?: string
  /** Sits opposite the title — a switch that governs the whole card. */
  extra?: React.ReactNode
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
export default function SectionCard({ children, className, extra, subtitle, title }: SectionCardProps) {
  return (
    <div
      className={`bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-py-5 ${className ?? ''}`}
    >
      {/* Wraps rather than squeezing: on a narrow card the switch or button
          drops under the title instead of crushing it a letter per line. */}
      <div className="bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-4">
        <div className="bc-min-w-0 bc-flex-1 bc-basis-48">
          <Title className="bc-mb-1" level={4}>
            {title}
          </Title>
          {subtitle && (
            <Text className="bc-block bc-text-xs" type="secondary">
              {subtitle}
            </Text>
          )}
        </div>
        {extra && <div className="bc-shrink-0 bc-pt-1">{extra}</div>}
      </div>
      {children && <div className="bc-mt-5">{children}</div>}
    </div>
  )
}
