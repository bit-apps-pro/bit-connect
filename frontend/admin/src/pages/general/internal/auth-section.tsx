import { __ } from '@common/helpers/i18nWrap'
import { Input, Switch, Typography } from 'antd'
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
        subtitle={__('Choose where people sign in and create an account.')}
        title={__('Sign-in method')}
      >
        <SettingRow full label={__('Login and registration form')}>
          <div
            aria-label={__('Login and registration form')}
            className="bc-flex bc-flex-wrap bc-gap-3"
            role="radiogroup"
          >
            <ChoiceCard
              checked={form.mode === 'plugin_default'}
              description={__(
                'People sign in and register on the portal itself. You choose its banner, heading and wording below.'
              )}
              disabled={disabled}
              label={__('Built-in form')}
              name="auth-mode"
              onSelect={value => onPatch({ mode: value as AuthMode })}
              value="plugin_default"
            />
            <ChoiceCard
              checked={form.mode === 'custom_url'}
              description={__(
                'People are sent to pages you already have, like the ones from a membership plugin or your theme.'
              )}
              disabled={disabled}
              label={__('My own login page')}
              name="auth-mode"
              onSelect={value => onPatch({ mode: value as AuthMode })}
              value="custom_url"
            />
          </div>
        </SettingRow>
      </SectionCard>

      {/* One mode's settings leave before the other's arrive: these two panels
          are different lengths, and cross-fading them would shuffle the page
          under the pointer that just picked one. */}
      <AnimatePresence initial={false} mode="wait">
        {form.mode === 'plugin_default' ? (
          <motion.div animate="in" exit="out" initial="out" key="plugin_default" variants={swapVariants}>
            <SectionCard
              subtitle={__('Customize the built-in sign-in and registration page.')}
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

            {/* No role picker here: people who register get the site's "New
                User Default Role" from Settings → General, the same role
                WordPress's own registration form gives, so the forum's form
                can never hand out more than WordPress does. */}
            <SectionCard
              subtitle={__('Rules for people who sign up through the built-in form.')}
              title={__('New accounts')}
            >
              <SettingRow
                description={__(
                  'New members have to confirm their email address before they can sign in.'
                )}
                label={__('Require email verification')}
              >
                <Switch
                  checked={form.requireEmailVerification}
                  disabled={disabled}
                  onChange={checked => onPatch({ requireEmailVerification: checked })}
                />
              </SettingRow>
            </SectionCard>
          </motion.div>
        ) : (
          <motion.div animate="in" exit="out" initial="out" key="custom_url" variants={swapVariants}>
            <SectionCard
              subtitle={__('Send people to your own sign-in pages instead of the built-in form.')}
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
