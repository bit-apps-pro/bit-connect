import { cn } from '@common/helpers/globalHelpers'
import { Switch } from 'antd'

export interface SeoField {
  control: 'switch'
  /** What the setting does, in a sentence. Sits under the label. */
  description: React.ReactNode
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
    <div>
      {fields.map(field => (
        <div
          className={cn(
            'bc-flex bc-items-center bc-justify-between bc-gap-4 bc-py-4',
            // A rule above every row, the first included, so the list reads as
            // sitting under the card's heading. Explicit border-style because
            // the WordPress admin stylesheet resets it, and explicit zero
            // widths because that style applies to all four sides: without
            // them the other three fall back to the browser's medium width.
            'bc-border-0 bc-border-t bc-border-solid bc-border-t-line'
          )}
          key={field.key}
        >
          <div className="bc-min-w-0 bc-flex-1">
            <div className="bc-text-sm bc-font-medium bc-text-ink">{field.label}</div>
            <div className="bc-mt-1 bc-text-xs bc-text-ink-subtle">{field.description}</div>
          </div>

          <Switch
            aria-label={field.label}
            checked={field.value}
            className="bc-shrink-0"
            disabled={disabled || Boolean(field.disabled)}
            onChange={field.onChange}
          />
        </div>
      ))}
    </div>
  )
}
