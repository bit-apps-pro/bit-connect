import { __ } from '@common/helpers/i18nWrap'
import { Input, Radio, Select, Switch, Typography } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'

import {
  type AuthLoginPageCustomization,
  type AuthMode,
  type AuthSettings
} from '../../settings/shared/types'
import ChoiceCard from './choice-card'
import ImageField from './image-field'
import { swapVariants } from './motion'
import SectionCard from './section-card'
import SettingRow from './setting-row'

const { Text } = Typography

interface AuthSectionProps {
  disabled: boolean
  form: AuthSettings
  onCopy: (value: string) => void
  onPatch: (values: Partial<AuthSettings>) => void
}

/** How people sign in, and what the page they sign in on says. */
export default function AuthSection({ disabled, form, onCopy, onPatch }: AuthSectionProps) {
  const patchLoginPage = (values: Partial<AuthLoginPageCustomization>) =>
    onPatch({
      loginPageCustomization: {
        ...form.loginPageCustomization,
        ...values
      } satisfies AuthLoginPageCustomization
    })

  return (
    <>
      <SectionCard
        subtitle={__('Where visitors go when they need an account.')}
        title={__('Sign-in method')}
      >
        <SettingRow full label={__('Login and registration form')}>
          <Radio.Group
            className="bc-w-full"
            disabled={disabled}
            onChange={e => onPatch({ mode: e.target.value as AuthMode })}
            value={form.mode}
          >
            <div className="bc-grid bc-gap-3 md:bc-grid-cols-2">
              <ChoiceCard
                description={__(
                  'People sign in and register on the portal itself. You choose its banner, heading and wording below.'
                )}
                groupId="auth-mode"
                label={__('Built-in form')}
                selected={form.mode === 'plugin_default'}
                value="plugin_default"
              />
              <ChoiceCard
                description={__(
                  'People are sent to pages you already have — a membership plugin, or your theme.'
                )}
                groupId="auth-mode"
                label={__('My own login page')}
                selected={form.mode === 'custom_url'}
                value="custom_url"
              />
            </div>
          </Radio.Group>
        </SettingRow>
      </SectionCard>

      {/* One mode's settings leave before the other's arrive: these two panels
          are different lengths, and cross-fading them would shuffle the page
          under the pointer that just picked one. */}
      <AnimatePresence initial={false} mode="wait">
        {form.mode === 'plugin_default' ? (
          <motion.div animate="in" exit="out" initial="out" key="plugin_default" variants={swapVariants}>
            <SectionCard
              subtitle={__('What the built-in login and registration page shows.')}
              title={__('Login page')}
            >
              <SettingRow
                description={__('Sits at the top of the form. A wide, transparent image reads best.')}
                label={__('Banner')}
              >
                <ImageField
                  alt={__('Login banner preview')}
                  disabled={disabled}
                  onChange={url => patchLoginPage({ banner: url })}
                  value={form.loginPageCustomization.banner}
                />
              </SettingRow>

              <SettingRow description={__('The heading above the form.')} label={__('Title')}>
                <Input
                  disabled={disabled}
                  onChange={e => patchLoginPage({ title: e.target.value })}
                  placeholder={__('e.g. Welcome back!')}
                  value={form.loginPageCustomization.title}
                />
              </SettingRow>

              <SettingRow description={__('A line or two below the title.')} label={__('Description')}>
                <Input.TextArea
                  disabled={disabled}
                  onChange={e => patchLoginPage({ description: e.target.value })}
                  placeholder={__('e.g. Sign in to join the conversation.')}
                  rows={3}
                  value={form.loginPageCustomization.description}
                />
              </SettingRow>

              <SettingRow
                description={__('Send people straight to the form with these links.')}
                full
                label={__('Page addresses')}
              >
                <div className="bc-grid bc-gap-4 md:bc-grid-cols-2">
                  <div>
                    <Text className="bc-mb-2 bc-block bc-text-sm" type="secondary">
                      {__('Login')}
                    </Text>
                    <Input.Search
                      enterButton={__('Copy')}
                      onSearch={() => onCopy(form.loginPageUrl)}
                      readOnly
                      value={form.loginPageUrl}
                    />
                  </div>
                  <div>
                    <Text className="bc-mb-2 bc-block bc-text-sm" type="secondary">
                      {__('Registration')}
                    </Text>
                    <Input.Search
                      enterButton={__('Copy')}
                      onSearch={() => onCopy(form.registrationPageUrl)}
                      readOnly
                      value={form.registrationPageUrl}
                    />
                  </div>
                </div>
              </SettingRow>
            </SectionCard>

            <SectionCard
              subtitle={__('What happens when someone registers through the built-in form.')}
              title={__('New accounts')}
            >
              <SettingRow
                description={__('The WordPress role people get when they register.')}
                label={__('Registration role')}
              >
                <Select
                  className="bc-w-full"
                  disabled={disabled}
                  onChange={value => onPatch({ registrationRole: value })}
                  options={form.availableRoles}
                  placeholder={__('Select a role')}
                  value={form.registrationRole || undefined}
                />
              </SettingRow>

              <SettingRow
                description={__(
                  'New members have to confirm their email address before they can sign in.'
                )}
                label={__('Require email verification')}
              >
                <div className="md:bc-text-right">
                  <Switch
                    checked={form.requireEmailVerification}
                    disabled={disabled}
                    onChange={checked => onPatch({ requireEmailVerification: checked })}
                  />
                </div>
              </SettingRow>
            </SectionCard>
          </motion.div>
        ) : (
          <motion.div animate="in" exit="out" initial="out" key="custom_url" variants={swapVariants}>
            <SectionCard
              subtitle={__('Where the portal sends people instead of showing its own form.')}
              title={__('Your login pages')}
            >
              <SettingRow description={__('The page people sign in on.')} label={__('Login page URL')}>
                <Input
                  disabled={disabled}
                  onChange={e => onPatch({ customLoginUrl: e.target.value })}
                  placeholder="https://example.com/login"
                  value={form.customLoginUrl}
                />
              </SettingRow>

              <SettingRow
                description={__(
                  'The page people create an account on. Leave empty to reuse the login page.'
                )}
                label={__('Registration page URL')}
              >
                <Input
                  disabled={disabled}
                  onChange={e => onPatch({ customRegistrationUrl: e.target.value })}
                  placeholder="https://example.com/register"
                  value={form.customRegistrationUrl}
                />
              </SettingRow>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
