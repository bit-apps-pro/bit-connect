import { __ } from '@common/helpers/i18nWrap'
import { Segmented, Typography } from 'antd'
import { type ReactNode, useMemo } from 'react'

import { type TopicFieldMode } from '../shared/types'

const { Text } = Typography

interface FieldModeRowProps {
  description: string
  disabled?: boolean
  label: string
  /** Rendered under the description, e.g. what the current mode means elsewhere. */
  note?: ReactNode
  onChange: (mode: TopicFieldMode) => void
  value: TopicFieldMode
}

/**
 * One topic-form field: whether the form asks for it, and whether it may be
 * left blank. Three states rather than a switch, because "shown" and
 * "required" are separate answers — a field can be worth asking for without
 * being worth blocking a post over.
 */
export default function FieldModeRow({
  description,
  disabled = false,
  label,
  note,
  onChange,
  value
}: FieldModeRowProps) {
  // Built here rather than at module scope: WordPress loads the translations
  // after the bundle.
  const options = useMemo(
    () => [
      { label: __('Hidden'), value: 'hidden' },
      { label: __('Optional'), value: 'optional' },
      { label: __('Required'), value: 'required' }
    ],
    []
  )

  return (
    <div className="bc-rounded-md bc-border bc-border-solid bc-border-line bc-px-4 bc-py-3.5">
      <div className="bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-x-4 bc-gap-y-2">
        <Text className="bc-text-sm bc-font-medium bc-text-ink">{label}</Text>
        <Segmented
          aria-label={label}
          disabled={disabled}
          onChange={mode => onChange(mode as TopicFieldMode)}
          options={options}
          size="small"
          value={value}
        />
      </div>
      <Text className="bc-mt-1.5 bc-block bc-text-sm" type="secondary">
        {description}
      </Text>
      {note}
    </div>
  )
}
