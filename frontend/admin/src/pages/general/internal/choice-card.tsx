import { cn } from '@common/helpers/globalHelpers'
import { Radio, Typography } from 'antd'
import { motion } from 'framer-motion'

import { SOFT_SPRING } from './motion'

const { Text } = Typography

interface ChoiceCardProps {
  description: string
  /** Groups the sliding ring — one id per Radio.Group, never shared. */
  groupId: string
  label: string
  selected: boolean
  value: string
}

/**
 * One option in a two-card choice, where the whole card is the radio's label.
 *
 * The ring around the chosen card is a single `layoutId` element, so picking
 * the other option slides it across rather than blinking it out on one card and
 * in on the other: the eye follows one thing moving and lands on the answer,
 * which is the whole point of showing both options side by side.
 */
export default function ChoiceCard({ description, groupId, label, selected, value }: ChoiceCardProps) {
  return (
    <Radio
      className={cn([
        'bc-relative bc-m-0 bc-flex bc-w-full bc-items-start bc-rounded-md bc-border bc-border-solid bc-p-4',
        selected ? 'bc-border-primary/40' : 'bc-border-line hover:bc-border-primary/30'
      ])}
      value={value}
    >
      {selected && (
        <motion.span
          aria-hidden
          className="bc-pointer-events-none bc-absolute bc-inset-0 bc-rounded-md bc-bg-primary/5 bc-ring-2 bc-ring-primary/50"
          layoutId={`${groupId}-selection`}
          transition={SOFT_SPRING}
        />
      )}
      <span className="bc-relative bc-block bc-font-medium">{label}</span>
      <Text className="bc-relative bc-mt-1 bc-block bc-text-sm" type="secondary">
        {description}
      </Text>
    </Radio>
  )
}
