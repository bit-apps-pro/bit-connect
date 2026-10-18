import { __ } from '@common/helpers/i18nWrap'
import { Switch } from 'antd'

import { type GeneralSettings } from '../shared/types'
import SectionCard from './section-card'
import SettingRow from './setting-row'

interface SidebarSectionProps {
  disabled: boolean
  form: GeneralSettings
  onPatch: (values: Partial<GeneralSettings>) => void
}

/** Which links the portal sidebar shows, beside the stages. */
export default function SidebarSection({ disabled, form, onPatch }: SidebarSectionProps) {
  return (
    <SectionCard subtitle={__('Select the links that the portal sidebar shows.')} title={__('Sidebar')}>
      <SettingRow
        description={__(
          'Show a link to the posts that the member follows. Visitors who are not logged in do not see this link.'
        )}
        inline
        label={__('Show Following')}
      >
        <Switch
          aria-label={__('Show Following')}
          checked={form.sidebarFollowing}
          disabled={disabled}
          onChange={checked => onPatch({ sidebarFollowing: checked })}
          size="small"
        />
      </SettingRow>
    </SectionCard>
  )
}
