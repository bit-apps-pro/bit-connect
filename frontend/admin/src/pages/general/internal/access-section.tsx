import { __ } from '@common/helpers/i18nWrap'

import { type GeneralSettings, type PortalAccess } from '../shared/types'
import ChoiceCard from './choice-card'
import SectionCard from './section-card'
import SettingRow from './setting-row'

interface AccessSectionProps {
  disabled: boolean
  form: GeneralSettings
  onPatch: (values: Partial<GeneralSettings>) => void
}

/** Who gets in: everyone, or members only. */
export default function AccessSection({ disabled, form, onPatch }: AccessSectionProps) {
  return (
    <SectionCard
      subtitle={__('Choose whether your community is open to everyone or only to members.')}
      title={__('Access')}
    >
      <SettingRow
        description={__('Decide whether visitors can read posts without signing in.')}
        full
        label={__('Who can see the portal')}
      >
        <div
          aria-label={__('Who can see the portal')}
          className="bc-flex bc-flex-wrap bc-gap-3"
          role="radiogroup"
        >
          <ChoiceCard
            checked={form.portalAccess === 'everyone'}
            description={__(
              'Anyone can read posts, and search engines can index them. To create a post, a visitor still needs an account.'
            )}
            disabled={disabled}
            label={__('Everyone')}
            name="portal-access"
            onSelect={value => onPatch({ portalAccess: value as PortalAccess })}
            value="everyone"
          />
          <ChoiceCard
            checked={form.portalAccess === 'logged_in'}
            description={__(
              'Visitors are sent to sign in first. Nothing in the portal is publicly readable or indexable.'
            )}
            disabled={disabled}
            label={__('Logged-in users only')}
            name="portal-access"
            onSelect={value => onPatch({ portalAccess: value as PortalAccess })}
            value="logged_in"
          />
        </div>
      </SettingRow>
    </SectionCard>
  )
}
