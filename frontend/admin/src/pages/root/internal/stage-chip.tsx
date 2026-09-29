import { Tag } from 'antd'

import useChipProps from '@/utils/use-chip-props'

/** A topic's stage, in the colour the dashboard draws that stage everywhere. */
export default function StageChip({ hue, name }: { hue?: string; name: string }) {
  const { chipTagProps } = useChipProps()

  return (
    // Truncated past 12rem: a stage name is whatever the site owner typed, and
    // a nowrap chip with no cap widened its table column off the card.
    <Tag
      bordered
      className="bc-m-0 bc-max-w-48 bc-truncate bc-align-middle bc-text-xs bc-font-medium"
      title={name}
      {...chipTagProps(hue)}
    >
      {name}
    </Tag>
  )
}
