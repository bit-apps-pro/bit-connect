import { Select } from 'antd'
import { type ReactNode } from 'react'

export interface TermOption {
  color?: null | string
  id: number
  name: string
}

/** A term's name behind a dot of its colour, as the portal's chips show it. */
export function TermLabel({ color, name }: { color?: null | string; name: string }) {
  return (
    <span className="bc-flex bc-min-w-0 bc-items-center bc-gap-2">
      <span
        aria-hidden
        className="bc-inline-block bc-size-2 bc-shrink-0 bc-rounded-full bc-bg-ink-subtle"
        style={color ? { backgroundColor: color } : undefined}
      />
      <span className="bc-truncate">{name}</span>
    </span>
  )
}

interface TermSelectProps {
  allowClear?: boolean
  className?: string
  disabled?: boolean
  onChange: (id: number | undefined) => void
  placeholder?: string
  size?: 'middle' | 'small'
  terms: TermOption[]
  value?: number
  variant?: 'borderless' | 'outlined'
}

/** Picks one status, stage or type, each shown in its colour. */
export default function TermSelect({ terms, ...props }: TermSelectProps): ReactNode {
  return (
    <Select
      {...props}
      optionFilterProp="title"
      options={terms.map(term => ({
        label: <TermLabel color={term.color} name={term.name} />,
        title: term.name,
        value: term.id
      }))}
      popupMatchSelectWidth={false}
      showSearch
    />
  )
}
