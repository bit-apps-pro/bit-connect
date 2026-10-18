import { cn } from '@common/helpers/globalHelpers'
import { Divider, Typography } from 'antd'

const { Text } = Typography

interface SettingRowProps {
  children: React.ReactNode
  description?: React.ReactNode
  /**
   * Let the control take the card's full width — for anything a form-field
   * column would squash, such as a textarea or a grid of cards.
   */
  full?: boolean
  /**
   * Put a small control — a switch and its hint — on the label's own line,
   * with the description underneath both.
   */
  inline?: boolean
  label: string
}

/**
 * A label, what it does, and its control.
 *
 * The control sits under its label at every width, so the eye runs straight
 * down one edge of the card, and a phone reads it the same as a desktop. An
 * ordinary field keeps a form-field width rather than stretching across a wide
 * card, where a short title would sit in a mostly empty box.
 */
export default function SettingRow({
  children,
  description,
  full = false,
  inline = false,
  label
}: SettingRowProps) {
  if (inline) {
    return (
      <>
        <Divider className="bc-my-0" />
        <div className="bc-py-4">
          <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-3">
            <Text className="bc-text-sm bc-text-inherit" strong>
              {label}
            </Text>
            {children}
          </div>
          {description && (
            <Text className="bc-mt-1 bc-block bc-max-w-lg bc-text-xs" type="secondary">
              {description}
            </Text>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      {/* Above the row rather than below it: the last row in a card changes
          with whatever the form is showing, and a rule under it hangs. */}
      <Divider className="bc-my-0" />
      <div className="bc-flex bc-flex-col bc-gap-2.5 bc-py-4">
        <div className="bc-min-w-0">
          <Text className="bc-block bc-text-sm bc-text-inherit" strong>
            {label}
          </Text>
          {description && (
            <Text className="bc-mt-0.5 bc-block bc-text-xs" type="secondary">
              {description}
            </Text>
          )}
        </div>
        <div className={cn(['bc-min-w-0', !full && 'bc-w-full bc-max-w-sm'])}>{children}</div>
      </div>
    </>
  )
}
