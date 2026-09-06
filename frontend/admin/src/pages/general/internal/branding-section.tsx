import { __ } from '@common/helpers/i18nWrap'
import { Input, Segmented } from 'antd'

import { type GeneralSettings, type LogoPermalinkMode } from '../shared/types'
import ImageField from './image-field'
import SectionCard from './section-card'
import SettingRow from './setting-row'

interface BrandingSectionProps {
  disabled: boolean
  form: GeneralSettings
  onCopy: (value: string) => void
  onPatch: (values: Partial<GeneralSettings>) => void
  /** Where the portal actually lives, used as the default logo destination. */
  portalUrl: string
}

/** What the portal is called and what it looks like at the top of every page. */
export default function BrandingSection({
  disabled,
  form,
  onCopy,
  onPatch,
  portalUrl
}: BrandingSectionProps) {
  return (
    <SectionCard
      subtitle={__('The name and logo the portal shows visitors, and where the logo takes them.')}
      title={__('Branding')}
    >
      <SettingRow
        description={__(
          'Used for the browser tab, the meta title and the name emails are sent under. It usually reads best as your site title.'
        )}
        label={__('Portal title')}
      >
        <Input
          disabled={disabled}
          onChange={e => onPatch({ communityTitle: e.target.value })}
          placeholder={__('e.g. Acme Community')}
          value={form.communityTitle}
        />
      </SettingRow>

      <SettingRow
        description={__(
          'Shown in the portal header. A wide, transparent image reads best — around 480 × 120, or 4:1.'
        )}
        label={__('Logo')}
      >
        <ImageField
          alt={__('Site logo preview')}
          disabled={disabled}
          onChange={url => onPatch({ logoLight: url })}
          value={form.logoLight}
        />
      </SettingRow>

      <SettingRow description={__('Where clicking the logo takes a visitor.')} label={__('Logo link')}>
        <div className="bc-flex bc-flex-col bc-gap-2">
          <Segmented
            block
            disabled={disabled}
            onChange={value => onPatch({ logoPermalinkMode: value as LogoPermalinkMode })}
            options={[
              { label: __('Portal home'), value: 'default' },
              { label: __('Custom URL'), value: 'custom' }
            ]}
            value={form.logoPermalinkMode}
          />
          {form.logoPermalinkMode === 'default' ? (
            <Input.Search
              disabled
              enterButton={__('Copy')}
              onSearch={() => onCopy(portalUrl)}
              readOnly
              value={portalUrl}
            />
          ) : (
            <Input
              disabled={disabled}
              onChange={e => onPatch({ logoPermalinkCustom: e.target.value })}
              placeholder="https://example.com"
              value={form.logoPermalinkCustom}
            />
          )}
        </div>
      </SettingRow>
    </SectionCard>
  )
}
