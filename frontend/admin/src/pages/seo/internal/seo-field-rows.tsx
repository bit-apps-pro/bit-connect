import { cn } from '@common/helpers/globalHelpers'
import { Switch, Typography } from 'antd'

const { Text } = Typography

export interface SeoField {
  control: 'switch'
  /** What the setting does, in a sentence. Sits under the label. */
  description: string
  disabled?: boolean
  key: string
  label: string
  onChange: (value: boolean) => void
  value: boolean
}

interface SeoFieldRowsProps {
  disabled?: boolean
  fields: SeoField[]
}

/**
 * A vertical list of settings: label and explanation on the left, the switch
 * on the right, one per row.
 *
 * This is the shape every SEO plugin uses for its settings — Rank Math, Yoast
 * and AIOSEO all present them as rows rather than as a grid of cards, and an
 * administrator arriving from one of those expects to find them that way.
 */
export default function SeoFieldRows({ disabled = false, fields }: SeoFieldRowsProps) {
  return (
    <div className="bc-overflow-hidden bc-rounded-md bc-border bc-border-solid bc-border-line">
      {fields.map((field, index) => (
        <div
          className={cn(
            'bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-4 bc-p-4',
            // A divider between rows rather than around each one. Explicit
            // border-style because the WordPress admin stylesheet resets it,
            // and explicit zero widths because that style applies to all four
            // sides: without them the other three fall back to the browser's
            // default medium width.
            index > 0 && 'bc-border-0 bc-border-t bc-border-solid bc-border-line'
          )}
          key={field.key}
        >
          <div className="bc-min-w-[16rem] bc-flex-1">
            <Text strong>{field.label}</Text>
            <p className="bc-mb-0 bc-mt-1 bc-text-sm bc-text-ink-muted">{field.description}</p>
          </div>

          <div className="bc-shrink-0">
            <Switch
              checked={field.value}
              disabled={disabled || Boolean(field.disabled)}
              onChange={field.onChange}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
