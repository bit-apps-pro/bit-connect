import { __ } from '@common/helpers/i18nWrap'
import { Button, Result, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useAuthStore } from '@/store/auth.zustand'
import { verifyEmailApi, verifyEmailChangeApi } from '@/store/data/auth-api'

import AuthCard from './AuthCard'

type VerifyState = 'error' | 'loading' | 'success'

// Module-level set survives React StrictMode's unmount+remount cycle,
// ensuring each token is only submitted once even in development.
const verifiedTokens = new Set<string>()

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const { checkAuth, setUser } = useAuthStore()

  // Two flows land here. `token` confirms a new registration and signs the
  // member in; `email_token` confirms an address change on an account that
  // already exists and changes no auth state.
  const emailChangeToken = searchParams.get('email_token') ?? ''
  const token = emailChangeToken || (searchParams.get('token') ?? '')
  const isEmailChange = Boolean(emailChangeToken)
  const userId = Number(searchParams.get('uid') ?? 0) || undefined

  const [state, setState] = useState<VerifyState>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token || (isEmailChange && !userId)) {
      setState('error')
      setErrorMsg(__('Invalid verification link.'))
      return
    }

    if (verifiedTokens.has(token)) return
    verifiedTokens.add(token)

    const confirm =
      isEmailChange && userId ? verifyEmailChangeApi(token, userId) : verifyEmailApi(token, userId)

    confirm
      .then(async response => {
        if (response.data && 'id' in response.data) {
          if (isEmailChange) {
            // Never setUser() here. A confirmation link is meant to be opened
            // from the new inbox, which is often a browser with no session —
            // seeding the store from the response would show that visitor as
            // logged in with no auth cookie, and every request after would 401.
            // Asking the server is right either way.
            await checkAuth()
          } else {
            setUser(response.data)
          }
          setState('success')
        } else {
          setState('error')
          setErrorMsg(__('Verification failed. Please try again.'))
        }
      })
      .catch((error: unknown) => {
        verifiedTokens.delete(token)
        const errObj = error as Record<string, unknown>
        const msg =
          typeof errObj?.data === 'string'
            ? errObj.data
            : typeof errObj?.message === 'string'
              ? errObj.message
              : __('Verification failed. Please try again.')
        setState('error')
        setErrorMsg(msg)
      })
  }, [token, userId, setUser, checkAuth, isEmailChange])

  return (
    <AuthCard leftTitle={isEmailChange ? __('Email Change') : __('Email Verification')}>
      {state === 'loading' && (
        <div className="bc-flex bc-flex-col bc-items-center bc-gap-4 bc-py-8">
          <Spin size="large" />
          <p className="bc-text-ink-muted bc-mb-0">{__('Verifying your email address…')}</p>
        </div>
      )}

      {state === 'success' && (
        <Result
          extra={
            <Button
              onClick={() => {
                window.location.replace(window.location.pathname.replace(/\/verify-email.*$/, '') || '/')
              }}
              type="primary"
            >
              {__('Go to forum')}
            </Button>
          }
          status="success"
          subTitle={
            isEmailChange
              ? __('Your account now uses this email address.')
              : __('Your email has been verified. You are now logged in.')
          }
          title={isEmailChange ? __('Email address updated!') : __('Email verified!')}
        />
      )}

      {state === 'error' && (
        <Result
          extra={
            // Registering again is the way out of a failed signup, but it is
            // nonsense advice to someone whose account already exists.
            isEmailChange ? undefined : (
              <Link to="/register">
                <Button type="primary">{__('Register again')}</Button>
              </Link>
            )
          }
          status="error"
          subTitle={errorMsg}
          title={isEmailChange ? __('Could not change your email') : __('Verification failed')}
        />
      )}
    </AuthCard>
  )
}
