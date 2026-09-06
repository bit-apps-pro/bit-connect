import { __ } from '@common/helpers/i18nWrap'
import { Button } from 'antd'
import { type ReactNode, useEffect, useRef } from 'react'
import { LuLock } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router'

import { useAuthStore } from '@/store/auth.zustand'

import styles from './login-gate.module.css'

interface LoginGateProps {
  children: ReactNode
  message?: string
}

/**
 * Shows `children` behind a light blur with a small login prompt for logged-out
 * visitors, and renders them untouched once logged in. Used where hiding the UI
 * outright would leave the visitor with no idea the action exists (the comment box).
 */
export default function LoginGate({ children, message }: LoginGateProps) {
  const { isLoggedIn } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const gatedRef = useRef<HTMLDivElement>(null)

  // `inert` is not a React 18 prop, so it is set on the node directly. Without
  // it the blurred editor is still tabbable — pointer-events only stops mice.
  useEffect(() => {
    const node = gatedRef.current
    if (node) node.inert = !isLoggedIn
  }, [isLoggedIn])

  if (isLoggedIn) return <>{children}</>

  const redirectParam = `?redirect_to=${encodeURIComponent(
    `${location.pathname}${location.search}${location.hash}`
  )}`

  return (
    <div className={styles.gate}>
      <div aria-hidden className={styles.blurred} ref={gatedRef}>
        {children}
      </div>
      <div className={styles.overlay}>
        <div className={styles.prompt}>
          <LuLock color="#65676b" size={14} />
          <p className={styles.message}>{message ?? __('Log in to join the conversation.')}</p>
          <Button onClick={() => navigate(`/login${redirectParam}`)} shape="round" type="primary">
            {__('Login')}
          </Button>
        </div>
      </div>
    </div>
  )
}
