import { Tag } from 'antd'

import useChipProps from '@/utils/use-chip-props'

/** A topic's stage, in the colour the dashboard draws that stage everywhere. */
export default function StageChip({ hue, name }: { hue?: string; name: string }) {
  const { chipTagProps } = useChipProps()

  return (
    <Tag bordered className="bc-m-0 bc-whitespace-nowrap bc-text-xs bc-font-medium" {...chipTagProps(hue)}>
      {name}
    </Tag>
  )
}
