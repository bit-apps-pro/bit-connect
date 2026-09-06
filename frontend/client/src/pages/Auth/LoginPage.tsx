import { __ } from '@common/helpers/i18nWrap'
import { externalLoginUrl } from '@utils/auth-urls'
import { Alert, Button, Checkbox, Form, Input } from 'antd'
import { useEffect } from 'react'
import { LuLogIn } from 'react-icons/lu'
import { Link, useNavigate, useSearchParams } from 'react-router'

import config from '@/config/config'
import { useAuthStore } from '@/store/auth.zustand'

import AuthCard from './AuthCard'

interface LoginFormValues {
  password: string
  remember: boolean
  username: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect_to') || '/'
  const { error, isLoading, isLoggedIn, login, setError } = useAuthStore()

  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectTo, { replace: true })
    }
  }, [isLoggedIn, navigate, redirectTo])

  // Custom-URL mode hands sign-in over to another page. externalLoginUrl()
  // always resolves to something reachable — the configured page when it is
  // usable, the WordPress login URL otherwise — so this route can never strand
  // a visitor on an empty screen.
  const customLoginUrl = externalLoginUrl(redirectTo)

  useEffect(() => {
    if (customLoginUrl) {
      window.location.href = customLoginUrl
    }
  }, [customLoginUrl])

  if (customLoginUrl || isLoggedIn) {
    return
  }

  const handleSubmit = async (values: LoginFormValues) => {
    setError(undefined)
    try {
      await login({ password: values.password, remember: values.remember, username: values.username })
      navigate(redirectTo, { replace: true })
    } catch {
      // error is set in the store
    }
  }

  return (
    <AuthCard>
      <h2 className="bc-text-xl bc-font-semibold bc-text-ink bc-mb-6 bc-text-center">{__('Login')}</h2>

      {error && (
        <Alert
          className="bc-mb-5"
          closable
          message={error}
          onClose={() => setError(undefined)}
          type="error"
        />
      )}

      <Form<LoginFormValues> layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large">
        <Form.Item
          label={__('Username or email')}
          name="username"
          rules={[{ message: __('Please enter your username or email'), required: true }]}
        >
          <Input autoComplete="username" placeholder={__('Enter your username or email')} />
        </Form.Item>

        <Form.Item
          label={
            <div className="bc-flex bc-w-full bc-items-center bc-justify-between">
              <span>{__('Password')}</span>
              <Link
                className="bc-text-xs bc-text-primary hover:bc-text-primary/80 bc-font-medium bc-no-underline"
                to={`/forgot-password?redirect_to=${encodeURIComponent(redirectTo)}`}
              >
                {__('Forgot password?')}
              </Link>
            </div>
          }
          name="password"
          rules={[{ message: __('Please enter your password'), required: true }]}
        >
          <Input.Password autoComplete="current-password" placeholder={__('Enter your password')} />
        </Form.Item>

        <Form.Item initialValue={false} name="remember" valuePropName="checked">
          <Checkbox>{__('Remember me')}</Checkbox>
        </Form.Item>

        <Form.Item className="bc-mb-3">
          <Button
            block
            htmlType="submit"
            icon={<LuLogIn size={16} />}
            loading={isLoading}
            type="primary"
          >
            {__('Login')}
          </Button>
        </Form.Item>
      </Form>

      {config.CAN_REGISTER && (
        <p className="bc-text-center bc-text-sm bc-text-ink-muted bc-mt-4 bc-mb-0">
          {__("Don't have an account?")}{' '}
          <Link
            className="bc-text-primary hover:bc-text-primary/80 bc-font-medium"
            to={`/register?redirect_to=${encodeURIComponent(redirectTo)}`}
          >
            {__('Registration')}
          </Link>
        </p>
      )}
    </AuthCard>
  )
}
