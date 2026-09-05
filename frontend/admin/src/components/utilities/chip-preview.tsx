import { __ } from '@common/helpers/i18nWrap'
import { Tag, Typography } from 'antd'

import useChipProps from '@/utils/use-chip-props'

/**
 * How a picked colour will look on the portal.
 *
 * The colour picker shows the raw hue as a solid swatch, which is not what a
 * reader ever sees: the portal derives a tinted background and a contrast-safe
 * label from that hue (see `@shared/color/chip-colors`). Without this an admin
 * picking a pale yellow had no way to tell it would still be readable, and the
 * obvious mental model — "the chip will be this colour" — was wrong.
 */
export default function ChipPreview({ color, label }: { color?: string; label?: string }) {
  const { chipTagProps } = useChipProps()

  if (!color) return

  return (
    <div className="bc-mt-2 bc-flex bc-items-center bc-gap-2">
      <Typography.Text className="bc-text-xs" type="secondary">
        {__('Preview')}
      </Typography.Text>
      <Tag className="bc-m-0" {...chipTagProps(color)}>
        {label?.trim() || __('Sample')}
      </Tag>
    </div>
  )
}
