import { __ } from '@common/helpers/i18nWrap'
import { Button, Modal } from 'antd'
import { LuLogIn, LuUserPlus } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router'

import useLoginWarningStore from '../state/use-login-warning-store'

export default function LoginWarningModal() {
  const { close, isOpen } = useLoginWarningStore()
  const location = useLocation()
  const navigate = useNavigate()

  const redirectParam = `?redirect_to=${encodeURIComponent(
    `${location.pathname}${location.search}${location.hash}`
  )}`

  const handleLogin = () => {
    close()
    navigate(`/login${redirectParam}`)
  }

  const handleSignup = () => {
    close()
    navigate(`/register${redirectParam}`)
  }

  return (
    <Modal
      centered
      footer={
        <div className="bc-flex bc-w-full bc-gap-2 bc-mt-2">
          <Button block icon={<LuLogIn size={15} />} onClick={handleLogin} type="primary">
            {__('Login')}
          </Button>
          <Button block icon={<LuUserPlus size={15} />} onClick={handleSignup}>
            {__('Create Account')}
          </Button>
        </div>
      }
      onCancel={close}
      open={isOpen}
      title={__('Login required')}
      width={400}
    >
      <p className="bc-text-ink-muted bc-mb-0">
        {__(
          'You need to be logged in to perform this action. Please log in or create an account to continue.'
        )}
      </p>
    </Modal>
  )
}
