import { __, sprintf } from '@common/helpers/i18nWrap'
import { Alert, Button, Form, Input } from 'antd'
import { useEffect, useRef } from 'react'
import { LuLock, LuMail } from 'react-icons/lu'

import { useAuthStore } from '@/store/auth.zustand'

import useChangePassword, { type ChangePasswordPayload } from '../data/use-change-password'
import useRequestEmailChange, { type RequestEmailChangePayload } from '../data/use-request-email-change'
import useSendPasswordReset from '../data/use-send-password-reset'

const MIN_PASSWORD = 6

interface EmailFormValues {
  email: string
}

interface PasswordFormValues {
  current_password: string
  new_password: string
  new_password_confirm: string
}

/**
 * Email address and password — the two settings that are not part of a public
 * profile, and the two that previously meant leaving the portal for
 * wp-login.php.
 *
 * Kept in one card with a divider rather than two: they are both "how you get
 * into this account", and separating them would imply they live in different
 * places.
 *
 * Reads the address from the auth store, not the profile payload — the public
 * profile endpoint deliberately never returns an email.
 */
export default function AccountSecurityForm({ userId }: { userId: number | undefined }) {
  const { user } = useAuthStore()
  const [emailForm] = Form.useForm<EmailFormValues>()
  const [passwordForm] = Form.useForm<PasswordFormValues>()

  const { isRequestingEmailChange, requestEmailChange } = useRequestEmailChange(emailForm, userId)
  const { changePassword, isChangingPassword } = useChangePassword(passwordForm, userId)
  const { isSendingPasswordReset, sendPasswordReset } = useSendPasswordReset(userId)

  // Undefined means the WP-core fallback answered, which cannot report this.
  // Assume a password exists: asking for one that turns out not to be there is
  // recoverable via the reset link, while wrongly offering to set a first
  // password would skip the confirmation on an account that has one.
  const hasPassword = user?.has_password !== false

  const populatedForId = useRef<null | number>(undefined)

  useEffect(() => {
    if (!user || populatedForId.current === user.id) return
    populatedForId.current = user.id
    emailForm.setFieldsValue({ email: user.email })
  }, [emailForm, user])

  const handleEmail = async (values: EmailFormValues) => {
    const payload: RequestEmailChangePayload = { email: values.email }
    try {
      await requestEmailChange(payload)
    } catch {
      // Already reported by the hook.
    }
  }

  const handlePassword = async (values: PasswordFormValues) => {
    const payload: ChangePasswordPayload = { new_password: values.new_password }
    // Omitted rather than sent empty when the account has none, so the server
    // is never handed a "current password" that does not exist.
    if (hasPassword) payload.current_password = values.current_password
    try {
      await changePassword(payload)
    } catch {
      // Already reported by the hook.
    }
  }

  return (
    <section
      aria-label={__('Account and security')}
      className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4 sm:bc-p-5"
    >
      <h2 className="bc-mb-1 bc-mt-0 bc-text-[15px] bc-font-semibold bc-text-ink">
        {__('Account and security')}
      </h2>
      <p className="bc-mb-4 bc-mt-0 bc-text-[12px] bc-text-ink-subtle">
        {__('Only you can see these. They are never shown on your profile.')}
      </p>

      {user?.pending_email && (
        <Alert
          className="bc-mb-4"
          description={__('Open the link we sent to finish the change.')}
          message={sprintf(__('Waiting for you to confirm %s'), user.pending_email)}
          showIcon
          type="info"
        />
      )}

      <Form<EmailFormValues>
        className="[&_.ant-form-item-label>label]:bc-font-semibold"
        form={emailForm}
        layout="vertical"
        onFinish={handleEmail}
        requiredMark={false}
      >
        <Form.Item
          extra={__('We will email the new address to make sure you can read it.')}
          label={__('Email address')}
          name="email"
          rules={[
            { message: __('Please enter an email address'), required: true },
            { message: __('Please enter a valid email address'), type: 'email' }
          ]}
        >
          <Input
            autoComplete="email"
            placeholder={__('you@example.com')}
            prefix={<LuMail size={14} />}
          />
        </Form.Item>

        <Form.Item className="bc-mb-0">
          <Button htmlType="submit" loading={isRequestingEmailChange}>
            {__('Change email')}
          </Button>
        </Form.Item>
      </Form>

      <hr className="bc-my-5 bc-border-0 bc-border-t bc-border-solid bc-border-line" />

      {!hasPassword && (
        <Alert
          className="bc-mb-4"
          description={__(
            'You signed in without one, so there is nothing to confirm — just choose a password below.'
          )}
          message={__('Your account has no password yet')}
          showIcon
          type="info"
        />
      )}

      <Form<PasswordFormValues>
        className="[&_.ant-form-item-label>label]:bc-font-semibold"
        form={passwordForm}
        layout="vertical"
        onFinish={handlePassword}
        requiredMark={false}
      >
        {/* Omitted entirely for an account that has no password: there is
            nothing the member could put here, and showing it would be a door
            with no key. */}
        {hasPassword && (
          <Form.Item
            // Sits directly under the field it rescues, rather than at the end
            // of the form: a member who cannot fill this in should find the way
            // out without reading further. Kept out of the label itself, which
            // may not wrap a second interactive control.
            extra={
              <button
                className="bc-cursor-pointer bc-border-0 bc-bg-transparent bc-p-0 bc-text-xs bc-font-medium bc-text-primary hover:bc-text-primary/80 disabled:bc-cursor-default disabled:bc-text-ink-subtle"
                disabled={isSendingPasswordReset}
                onClick={() => {
                  void sendPasswordReset()
                }}
                type="button"
              >
                {isSendingPasswordReset ? __('Sending…') : __('Forgot password?')}
              </button>
            }
            label={__('Current password')}
            name="current_password"
            rules={[{ message: __('Please enter your current password'), required: true }]}
          >
            <Input.Password autoComplete="current-password" prefix={<LuLock size={14} />} />
          </Form.Item>
        )}

        <div className="bc-grid bc-gap-x-6 sm:bc-grid-cols-2">
          <Form.Item
            label={__('New password')}
            name="new_password"
            rules={[
              { message: __('Please enter a new password'), required: true },
              { message: __('Password must be at least 6 characters'), min: MIN_PASSWORD }
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            dependencies={['new_password']}
            label={__('Confirm new password')}
            name="new_password_confirm"
            rules={[
              { message: __('Please confirm your new password'), required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error(__('Passwords do not match')))
                }
              })
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </div>

        <Form.Item className="bc-mb-0">
          <Button htmlType="submit" loading={isChangingPassword}>
            {hasPassword ? __('Change password') : __('Set password')}
          </Button>
        </Form.Item>
      </Form>
    </section>
  )
}
