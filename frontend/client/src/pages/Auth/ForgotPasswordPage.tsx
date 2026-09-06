import { __ } from '@common/helpers/i18nWrap'
import { Alert, Button, Form, Input, Result } from 'antd'
import { useState } from 'react'
import { LuMailCheck, LuSend } from 'react-icons/lu'
import { Link, useSearchParams } from 'react-router'

import { forgotPasswordApi } from '@/store/data/auth-api'

import AuthCard from './AuthCard'

interface ForgotPasswordFormValues {
  login: string
}

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect_to') || '/'
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (values: ForgotPasswordFormValues) => {
    setError(undefined)
    setIsLoading(true)
    try {
      await forgotPasswordApi(values.login)
      setSuccess(true)
    } catch (error_: unknown) {
      const message =
        error_ instanceof Error ? error_.message : __('Something went wrong. Please try again.')
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <AuthCard>
        <Result
          icon={<LuMailCheck className="bc-mx-auto bc-text-primary" size={56} />}
          subTitle={__(
            'If an account exists for that username or email, a password reset link has been sent. Please check your inbox.'
          )}
          title={__('Check your email')}
        />
        <p className="bc-text-center bc-text-sm bc-text-ink-muted bc-mt-2 bc-mb-0">
          <Link
            className="bc-text-primary hover:bc-text-primary/80 bc-font-medium"
            to={`/login?redirect_to=${encodeURIComponent(redirectTo)}`}
          >
            {__('Back to Login')}
          </Link>
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <h2 className="bc-text-xl bc-font-semibold bc-text-ink bc-mb-2 bc-text-center">
        {__('Forgot Password')}
      </h2>
      <p className="bc-text-sm bc-text-ink-muted bc-text-center bc-mb-6">
        {__("Enter your username or email and we'll send you a reset link.")}
      </p>

      {error && (
        <Alert
          className="bc-mb-5"
          closable
          message={error}
          onClose={() => setError(undefined)}
          type="error"
        />
      )}

      <Form<ForgotPasswordFormValues>
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
        size="large"
      >
        <Form.Item
          label={__('Username or Email')}
          name="login"
          rules={[{ message: __('Please enter your username or email'), required: true }]}
        >
          <Input
            autoComplete="username email"
            // eslint-disable-next-line jsx-a11y/no-autofocus -- single-field form, focus is expected
            autoFocus
            placeholder={__('Enter your username or email')}
          />
        </Form.Item>

        <Form.Item className="bc-mb-3">
          <Button block htmlType="submit" icon={<LuSend size={16} />} loading={isLoading} type="primary">
            {__('Send Reset Link')}
          </Button>
        </Form.Item>
      </Form>

      <p className="bc-text-center bc-text-sm bc-text-ink-muted bc-mt-4 bc-mb-0">
        <Link
          className="bc-text-primary hover:bc-text-primary/80 bc-font-medium"
          to={`/login?redirect_to=${encodeURIComponent(redirectTo)}`}
        >
          {__('Back to Login')}
        </Link>
      </p>
    </AuthCard>
  )
}
