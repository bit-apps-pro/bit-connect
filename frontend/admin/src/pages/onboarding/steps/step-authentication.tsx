import { __ } from '@common/helpers/i18nWrap'
import useAuthSettings from '@pages/settings/data/use-auth-settings'
import useUpdateAuthSettings from '@pages/settings/data/use-update-auth-settings'
import { validateAuthForm } from '@pages/settings/shared/auth-validation'
import { type AuthMode, type AuthSettings } from '@pages/settings/shared/types'
import { Alert, Button, Input, Segmented, Skeleton, Space, Switch, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'

const { Text, Title } = Typography

interface Props {
  isFinishing: boolean
  onBack: () => void
  onFinish: () => void
}

export default function StepAuthentication({ isFinishing, onBack, onFinish }: Props) {
  const { authSettings, isAuthSettingsFetching } = useAuthSettings()
  const { isUpdatingAuthSettings, updateAuthSettings } = useUpdateAuthSettings()
  const [form, setForm] = useState<AuthSettings>(authSettings)
  const [formError, setFormError] = useState<string | undefined>()

  useEffect(() => {
    setForm(authSettings)
  }, [authSettings])

  const patch = useCallback((values: Partial<AuthSettings>) => {
    setForm(prev => ({ ...prev, ...values }))
  }, [])

  const handleFinish = async () => {
    // Same rule as the settings screen: custom-URL mode without a usable login
    // page would leave the portal with no way in.
    const error = validateAuthForm(form)
    if (error) {
      setFormError(error)
      return
    }
    setFormError(undefined)
    await updateAuthSettings(form)
    onFinish()
  }

  if (isAuthSettingsFetching) {
    return <Skeleton active paragraph={{ rows: 6 }} />
  }

  return (
    <div className="bc-flex bc-flex-col bc-gap-6">
      <div>
        <Title className="bc-mb-1" level={4}>
          {__('Authentication')}
        </Title>
        <Text type="secondary">{__('Choose how users will log in and register on your portal.')}</Text>
      </div>

      <div className="bc-flex bc-flex-col bc-gap-5">
        <div>
          <Text className="bc-block bc-mb-2" strong>
            {__('Auth Mode')}
          </Text>
          <Segmented
            onChange={val => patch({ mode: val as AuthMode })}
            options={[
              { label: __('Plugin Default'), value: 'plugin_default' },
              { label: __('Custom URL'), value: 'custom_url' }
            ]}
            value={form.mode}
          />
        </div>

        {form.mode === 'plugin_default' && (
          <>
            <div>
              <Text className="bc-block bc-mb-2" strong>
                {__('Login Page Title')}
              </Text>
              <Input
                onChange={e =>
                  patch({
                    loginPageCustomization: { ...form.loginPageCustomization, title: e.target.value }
                  })
                }
                placeholder={__('Welcome back!')}
                value={form.loginPageCustomization.title}
              />
            </div>

            <div>
              <Text className="bc-block bc-mb-2" strong>
                {__('Login Page Description')}
              </Text>
              <Input
                onChange={e =>
                  patch({
                    loginPageCustomization: {
                      ...form.loginPageCustomization,
                      description: e.target.value
                    }
                  })
                }
                placeholder={__('Sign in to continue')}
                value={form.loginPageCustomization.description}
              />
            </div>

            <div className="bc-flex bc-items-center bc-justify-between">
              <Text strong>{__('Require Email Verification')}</Text>
              <Switch
                checked={form.requireEmailVerification}
                onChange={checked => patch({ requireEmailVerification: checked })}
              />
            </div>
          </>
        )}

        {form.mode === 'custom_url' && (
          <>
            <div>
              <Text className="bc-block bc-mb-2" strong>
                {__('Custom Login URL')}
              </Text>
              <Input
                onChange={e => patch({ customLoginUrl: e.target.value })}
                placeholder="https://example.com/login"
                value={form.customLoginUrl}
              />
            </div>

            <div>
              <Text className="bc-block bc-mb-2" strong>
                {__('Custom Registration URL')}
              </Text>
              <Input
                onChange={e => patch({ customRegistrationUrl: e.target.value })}
                placeholder="https://example.com/register"
                value={form.customRegistrationUrl}
              />
            </div>
          </>
        )}
      </div>

      {formError && <Alert message={formError} showIcon type="error" />}

      <Space className="bc-justify-between">
        <Button onClick={onBack}>{__('Back')}</Button>
        <Button loading={isUpdatingAuthSettings || isFinishing} onClick={handleFinish} type="primary">
          {__('Finish Setup')}
        </Button>
      </Space>
    </div>
  )
}
