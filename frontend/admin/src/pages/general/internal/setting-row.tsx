import { cn } from '@common/helpers/globalHelpers'
import { Divider, Typography } from 'antd'

const { Text } = Typography

interface SettingRowProps {
  children: React.ReactNode
  description?: React.ReactNode
  /**
   * Put the control under its label instead of beside it — for anything a
   * 18rem column would squash, such as a textarea or a grid of cards.
   */
  full?: boolean
  label: string
}

/**
 * A label, what it does, and its control.
 *
 * Label and control sit side by side on a desktop screen and stack below it:
 * an admin panel is read at whatever width WordPress is open at, and a 18rem
 * control column beside a label leaves neither of them readable on a phone.
 *
 * A one-column grid that grows a second column, rather than a flex row that
 * wraps. `@tailwind` is layered in this app (see resource/styles/global.css),
 * which puts a base utility's `!important` above the `md:` variant's — so any
 * `bc-flex-col md:bc-flex-row` pair silently stays a column. Only classes with
 * no base counterpart to fight survive the cascade here.
 */
export default function SettingRow({ children, description, full = false, label }: SettingRowProps) {
  return (
    <>
      {/* Above the row rather than below it: the last row in a card changes
          with whatever the form is showing, and a rule under it hangs. */}
      <Divider className="bc-my-0" />
      <div
        className={cn([
          'bc-grid bc-gap-x-6 bc-gap-y-3 bc-py-5',
          !full && 'md:bc-grid-cols-[minmax(0,1fr)_18rem] md:bc-items-start'
        ])}
      >
        <div className="bc-min-w-0">
          <Text className="bc-block bc-text-inherit" strong>
            {label}
          </Text>
          {description && (
            <Text className="bc-mt-1 bc-block bc-text-sm" type="secondary">
              {description}
            </Text>
          )}
        </div>
        <div className="bc-min-w-0">{children}</div>
      </div>
    </>
  )
}
