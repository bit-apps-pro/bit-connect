import { cn } from '@common/helpers/globalHelpers'
import { InputNumber, Select, Switch, Typography } from 'antd'

const { Text } = Typography

interface FieldBase {
  /** What the setting does, in a sentence. Sits under the label. */
  description: string
  disabled?: boolean
  key: string
  label: string
}

export interface SeoSwitchField extends FieldBase {
  control: 'switch'
  onChange: (value: boolean) => void
  value: boolean
}

export interface SeoNumberField extends FieldBase {
  control: 'number'
  /** Used when the input is cleared — antd hands back null. */
  fallback: number
  max: number
  min: number
  onChange: (value: number) => void
  step?: number
  value: number
}

export interface SeoSelectField extends FieldBase {
  control: 'select'
  onChange: (value: string) => void
  options: { label: string; value: string }[]
  value: string
}

export type SeoField = SeoNumberField | SeoSelectField | SeoSwitchField

interface SeoFieldRowsProps {
  disabled?: boolean
  fields: SeoField[]
}

/**
 * A vertical list of settings: label and explanation on the left, the control
 * on the right, one per row.
 *
 * This is the shape every SEO plugin uses for its sitemap settings — Rank Math,
 * Yoast and AIOSEO all present them as rows rather than as a grid of cards, and
 * an administrator arriving from one of those expects to find them that way.
 *
 * It also accommodates a setting that is not a switch. The page's card grid
 * could not: a number among the switches had to be hand-built underneath the
 * grid in its own bordered box, which read as a separate, lesser setting rather
 * than as one of the group — and the same markup was duplicated wherever
 * another numeric setting appeared.
 */
export default function SeoFieldRows({ disabled = false, fields }: SeoFieldRowsProps) {
  return (
    <div className="bc-overflow-hidden bc-rounded-md bc-border bc-border-solid bc-border-line">
      {fields.map((field, index) => (
        <div
          className={cn(
            'bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-4 bc-p-4',
            // A divider between rows rather than around each one. Explicit
            // border-style because the WordPress admin stylesheet resets it.
            index > 0 && 'bc-border-t bc-border-solid bc-border-line'
          )}
          key={field.key}
        >
          <div className="bc-min-w-[16rem] bc-flex-1">
            <Text strong>{field.label}</Text>
            <p className="bc-mb-0 bc-mt-1 bc-text-sm bc-text-ink-muted">{field.description}</p>
          </div>

          <div className="bc-shrink-0">
            <FieldControl disabled={disabled || Boolean(field.disabled)} field={field} />
          </div>
        </div>
      ))}
    </div>
  )
}

function FieldControl({ disabled, field }: { disabled: boolean; field: SeoField }) {
  if (field.control === 'select') {
    return (
      <Select
        className="bc-w-60"
        disabled={disabled}
        onChange={field.onChange}
        options={field.options}
        value={field.value}
      />
    )
  }

  if (field.control === 'number') {
    return (
      <InputNumber
        disabled={disabled}
        max={field.max}
        min={field.min}
        onChange={value => field.onChange(Number(value ?? field.fallback))}
        step={field.step}
        value={field.value}
      />
    )
  }

  return <Switch checked={field.value} disabled={disabled} onChange={field.onChange} />
}
