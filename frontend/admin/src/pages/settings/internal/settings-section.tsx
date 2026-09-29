import { type ReactNode } from 'react'

import SectionCard from './section-card'
import SwitchRow from './switch-row'

interface SettingItem {
  description: string
  key: string
  label: string
  value: boolean
}

interface SettingsSectionProps {
  disabled?: boolean
  /** Rendered under the rows. Used for controls another plugin adds here. */
  note?: ReactNode
  onChange: (key: string, value: boolean) => void
  settings: SettingItem[]
  subtitle: string
  title: string
}

/**
 * A stack of on/off settings.
 *
 * Every switch here is real: it is bound to a stored value and the forum acts
 * on it. There is deliberately no disabled variant of a row: a switch for
 * something this plugin cannot do would not be a setting. A caller that has
 * something else to put under the rows passes `note`.
 */
export default function SettingsSection({
  disabled = false,
  note,
  onChange,
  settings,
  subtitle,
  title
}: SettingsSectionProps) {
  return (
    <SectionCard subtitle={subtitle} title={title}>
      <div className="bc-flex bc-flex-col bc-gap-3">
        {settings.map(setting => (
          <SwitchRow
            checked={setting.value}
            description={setting.description}
            disabled={disabled}
            key={setting.key}
            label={setting.label}
            onChange={checked => onChange(setting.key, checked)}
          />
        ))}

        {/*
          The caller passes `note` only when something actually filled the slot —
          an unconditional `<Slot />` element would be truthy however little it
          drew, and would add a gap under the last row for nothing.
        */}
        {note}
      </div>
    </SectionCard>
  )
}
