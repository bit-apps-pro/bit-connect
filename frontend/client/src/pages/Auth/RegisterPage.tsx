import { __ } from '@common/helpers/i18nWrap'
import { externalRegisterUrl } from '@utils/auth-urls'
import { Alert, Button, Form, Input, Result } from 'antd'
import { useEffect } from 'react'
import { LuMailCheck, LuUserPlus, LuUserX } from 'react-icons/lu'
import { Link, useNavigate, useSearchParams } from 'react-router'

import config from '@/config/config'
import { useAuthStore } from '@/store/auth.zustand'

import AuthCard from './AuthCard'

interface RegisterFormValues {
  display_name?: string
  email: string
  password: string
  password_confirm: string
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect_to') || '/'
  const {
    error,
    isLoading,
    isLoggedIn,
    pendingVerificationEmail,
    setError,
    setPendingVerificationEmail,
    signup
  } = useAuthStore()

  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectTo, { replace: true })
    }
  }, [isLoggedIn, navigate, redirectTo])

  // Custom-URL mode sends sign-ups to the site's own page; the resolver always
  // yields a reachable URL, falling back to the WordPress registration URL.
  const customRegisterUrl = externalRegisterUrl(redirectTo)

  useEffect(() => {
    if (customRegisterUrl) {
      window.location.href = customRegisterUrl
    }
  }, [customRegisterUrl])

  if (customRegisterUrl || isLoggedIn) {
    return
  }

  // WordPress registration is switched off site-wide. Bouncing to
  // wp-login.php?action=register would only show WordPress' own error page, so
  // explain it here and keep the visitor inside the portal.
  if (!config.CAN_REGISTER) {
    return (
      <AuthCard>
        <Result
          icon={<LuUserX className="bc-mx-auto bc-text-primary" size={56} />}
          subTitle={__('New account registration is currently disabled on this site.')}
          title={__('Registration is closed')}
        />
        <p className="bc-text-center bc-text-sm bc-text-ink-muted bc-mt-2 bc-mb-0">
          {__('Already have an account?')}{' '}
          <Link
            className="bc-text-primary hover:bc-text-primary/80 bc-font-medium"
            to={`/login?redirect_to=${encodeURIComponent(redirectTo)}`}
          >
            {__('Login')}
          </Link>
        </p>
      </AuthCard>
    )
  }

  if (pendingVerificationEmail) {
    return (
      <AuthCard>
        <Result
          icon={<LuMailCheck className="bc-mx-auto bc-text-primary" size={56} />}
          subTitle={
            <span>
              {__('We sent a verification link to')} <strong>{pendingVerificationEmail}</strong>.{' '}
              {__('Click the link in the email to activate your account.')}
            </span>
          }
          title={__('Almost there!')}
        />
        <p className="bc-text-center bc-text-sm bc-text-ink-muted bc-mt-2 bc-mb-0">
          {__('Wrong email?')}{' '}
          <Button className="bc-p-0" onClick={() => setPendingVerificationEmail(undefined)} type="link">
            {__('Go back')}
          </Button>
        </p>
      </AuthCard>
    )
  }

  const handleSubmit = async (values: RegisterFormValues) => {
    setError(undefined)
    const username = values.email.split('@')[0].replaceAll(/[^a-zA-Z0-9._-]/g, '')
    try {
      await signup({
        display_name: values.display_name || username,
        email: values.email,
        password: values.password,
        username
      })
    } catch {
      // error is set in the store
    }
  }

  return (
    <AuthCard>
      <h2 className="bc-text-xl bc-font-semibold bc-text-ink bc-mb-6 bc-text-center">
        {__('Registration')}
      </h2>

      {error && (
        <Alert
          className="bc-mb-5"
          closable
          message={error}
          onClose={() => setError(undefined)}
          type="error"
        />
      )}

      <Form<RegisterFormValues>
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        size="large"
      >
        <Form.Item
          label={__('Display Name')}
          name="display_name"
          rules={[{ max: 60, message: __('Display name must be 60 characters or fewer') }]}
        >
          <Input autoComplete="name" placeholder={__('Your public display name (optional)')} />
        </Form.Item>

        <Form.Item
          label={__('Email Address')}
          name="email"
          rules={[
            { message: __('Please enter your email address'), required: true },
            { message: __('Please enter a valid email address'), type: 'email' }
          ]}
        >
          <Input autoComplete="email" placeholder={__('Enter your email address')} />
        </Form.Item>

        <Form.Item
          label={__('Password')}
          name="password"
          rules={[
            { message: __('Please choose a password'), required: true },
            { message: __('Password must be at least 6 characters'), min: 6 }
          ]}
        >
          <Input.Password
            autoComplete="new-password"
            placeholder={__('Choose a password (min. 6 characters)')}
          />
        </Form.Item>

        <Form.Item
          dependencies={['password']}
          label={__('Confirm Password')}
          name="password_confirm"
          rules={[
            { message: __('Please confirm your password'), required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(new Error(__('Passwords do not match')))
              }
            })
          ]}
        >
          <Input.Password autoComplete="new-password" placeholder={__('Repeat your password')} />
        </Form.Item>

        <Form.Item className="bc-mb-3">
          <Button
            block
            htmlType="submit"
            icon={<LuUserPlus size={16} />}
            loading={isLoading}
            type="primary"
          >
            {__('Register')}
          </Button>
        </Form.Item>
      </Form>

      <p className="bc-text-center bc-text-sm bc-text-ink-muted bc-mt-4 bc-mb-0">
        {__('Already have an account?')}{' '}
        <Link
          className="bc-text-primary hover:bc-text-primary/80 bc-font-medium"
          to={`/login?redirect_to=${encodeURIComponent(redirectTo)}`}
        >
          {__('Login')}
        </Link>
      </p>
    </AuthCard>
  )
}
