import { Typography } from 'antd'
import { type ReactNode } from 'react'

const { Text, Title } = Typography

interface SectionCardProps {
  children?: ReactNode
  className?: string
  subtitle?: ReactNode
  title: string
}

/**
 * One titled group of settings, as tall as what it holds. Stretching it to its
 * grid row's tallest card left a short group sitting above empty white.
 */
export default function SectionCard({ children, className, subtitle, title }: SectionCardProps) {
  return (
    <div
      className={`bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-py-5 ${className ?? ''}`}
    >
      <Title className="bc-mb-1" level={4}>
        {title}
      </Title>
      {subtitle && (
        <Text className="bc-block bc-text-sm" type="secondary">
          {subtitle}
        </Text>
      )}
      {children && <div className="bc-mt-5">{children}</div>}
    </div>
  )
}
