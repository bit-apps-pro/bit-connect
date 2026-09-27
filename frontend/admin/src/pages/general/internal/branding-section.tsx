import { __ } from '@common/helpers/i18nWrap'
import { Button, Divider, Input, Segmented, Space, Switch, Typography } from 'antd'

import { type GeneralSettings, type LogoPermalinkMode } from '../shared/types'
import ImageField from './image-field'
import SectionCard from './section-card'
import SettingRow from './setting-row'

const { Text } = Typography

interface BrandingSectionProps {
  disabled: boolean
  form: GeneralSettings
  onCopy: (value: string) => void
  onPatch: (values: Partial<GeneralSettings>) => void
  /** Where the portal actually lives, used as the default logo destination. */
  portalUrl: string
}

/**
 * What the portal is called, what it looks like at the top of every page, and
 * whether its sidebar carries the Bit Apps card.
 */
export default function BrandingSection({
  disabled,
  form,
  onCopy,
  onPatch,
  portalUrl
}: BrandingSectionProps) {
  return (
    <SectionCard
      subtitle={__('How your community looks to visitors — its name, logo and where the logo leads.')}
      title={__('Branding')}
    >
      <SettingRow
        description={__(
          'Shown in the browser tab, in search results and as the sender name on emails. Your site name usually works well.'
        )}
        label={__('Portal title')}
      >
        <Input
          disabled={disabled}
          onChange={e => onPatch({ communityTitle: e.target.value })}
          placeholder={__('e.g. Bit Connect Community')}
          value={form.communityTitle}
        />
      </SettingRow>

      <SettingRow
        description={__(
          'Appears at the top of every community page. Use a wide image with a transparent background, about 480 × 120 px.'
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

      <SettingRow
        description={__('Choose where people go when they click your logo.')}
        full
        label={__('Logo link')}
      >
        {/* One line at a desktop width, as in the design: the choice, then
            what it resolves to. Wraps under itself on a narrow card. */}
        <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-2">
          <Segmented
            disabled={disabled}
            onChange={value => onPatch({ logoPermalinkMode: value as LogoPermalinkMode })}
            options={[
              { label: __('Portal home'), value: 'default' },
              { label: __('Custom URL'), value: 'custom' }
            ]}
            value={form.logoPermalinkMode}
          />
          {form.logoPermalinkMode === 'default' ? (
            // Read-only rather than disabled: a disabled field greys out its
            // Copy button with it, and copying is the one thing to do here.
            <Space.Compact className="bc-w-80 bc-max-w-full">
              <Input readOnly value={portalUrl} />
              <Button onClick={() => onCopy(portalUrl)} type="primary">
                {__('Copy')}
              </Button>
            </Space.Compact>
          ) : (
            <Input
              className="bc-w-80 bc-max-w-full"
              disabled={disabled}
              onChange={e => onPatch({ logoPermalinkCustom: e.target.value })}
              placeholder="https://example.com"
              value={form.logoPermalinkCustom}
            />
          )}
        </div>
      </SettingRow>

      {/* Worded as removing the branding, so the switch reads "on" for the
          default: the card links to bitapps.pro from the site's own public
          pages, and it shows only where an admin turns this off. */}
      <Divider className="bc-my-0" />
      <label className="bc-flex bc-items-center bc-gap-3 bc-py-4" htmlFor="remove-bit-apps-branding">
        <Text className="bc-text-sm" strong>
          {__('Remove Bit Apps Branding')}
        </Text>
        <Switch
          checked={!form.promo.enabled}
          disabled={disabled}
          id="remove-bit-apps-branding"
          onChange={checked => onPatch({ promo: { ...form.promo, enabled: !checked } })}
          size="small"
        />
      </label>
    </SectionCard>
  )
}
