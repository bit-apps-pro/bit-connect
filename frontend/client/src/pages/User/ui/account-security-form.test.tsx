import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const changePassword = vi.fn()
const requestEmailChange = vi.fn()
const sendPasswordReset = vi.fn()

vi.mock('../data/use-change-password', () => ({
  default: () => ({ changePassword, isChangingPassword: false })
}))
vi.mock('../data/use-request-email-change', () => ({
  default: () => ({ isRequestingEmailChange: false, requestEmailChange })
}))
vi.mock('../data/use-send-password-reset', () => ({
  default: () => ({ isSendingPasswordReset: false, sendPasswordReset })
}))

const authUser: { email: string; has_password?: boolean; id: number } = {
  email: 'aiden@example.com',
  id: 7
}
vi.mock('@/store/auth.zustand', () => ({
  useAuthStore: () => ({ user: authUser })
}))

const { default: AccountSecurityForm } = await import('./account-security-form')

describe('AccountSecurityForm', () => {
  beforeEach(() => {
    changePassword.mockReset()
    changePassword.mockResolvedValue({ data: {} })
    sendPasswordReset.mockReset()
    authUser.has_password = true
  })
  afterEach(cleanup)

  describe('an account that has a password', () => {
    it('asks for the current one and offers the reset link', () => {
      render(<AccountSecurityForm userId={7} />)

      expect(screen.getByLabelText('Current password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument()
    })

    it('sends the current password along with the new one', async () => {
      render(<AccountSecurityForm userId={7} />)

      await userEvent.type(screen.getByLabelText('Current password'), 'old-secret')
      await userEvent.type(screen.getByLabelText('New password'), 'new-secret')
      await userEvent.type(screen.getByLabelText('Confirm new password'), 'new-secret')
      await userEvent.click(screen.getByRole('button', { name: /change password/i }))

      await waitFor(() => expect(changePassword).toHaveBeenCalled())
      expect(changePassword.mock.calls[0][0]).toEqual({
        current_password: 'old-secret',
        new_password: 'new-secret'
      })
    })

    it('emails a reset link on request', async () => {
      render(<AccountSecurityForm userId={7} />)

      await userEvent.click(screen.getByRole('button', { name: /forgot password/i }))

      await waitFor(() => expect(sendPasswordReset).toHaveBeenCalled())
    })
  })

  describe('an SSO account with no password', () => {
    beforeEach(() => {
      authUser.has_password = false
    })

    it('does not ask for a password the member has never had', () => {
      render(<AccountSecurityForm userId={7} />)

      expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
      expect(screen.getByText('Your account has no password yet')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /set password/i })).toBeInTheDocument()
    })

    it('omits current_password from the payload entirely', async () => {
      render(<AccountSecurityForm userId={7} />)

      await userEvent.type(screen.getByLabelText('New password'), 'first-secret')
      await userEvent.type(screen.getByLabelText('Confirm new password'), 'first-secret')
      await userEvent.click(screen.getByRole('button', { name: /set password/i }))

      await waitFor(() => expect(changePassword).toHaveBeenCalled())
      expect(changePassword.mock.calls[0][0]).toEqual({ new_password: 'first-secret' })
    })

    it('hides the reset link, which would be useless without a password', () => {
      render(<AccountSecurityForm userId={7} />)

      expect(screen.queryByRole('button', { name: /forgot password/i })).not.toBeInTheDocument()
    })
  })

  it('treats an unknown has_password as "has one", so confirmation is never skipped', () => {
    authUser.has_password = undefined
    render(<AccountSecurityForm userId={7} />)

    expect(screen.getByLabelText('Current password')).toBeInTheDocument()
  })
})
