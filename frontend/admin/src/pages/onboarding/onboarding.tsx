import { __ } from '@common/helpers/i18nWrap'
import { Card, Steps, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import useCompleteOnboarding from './data/use-complete-onboarding'
import StepAuthentication from './steps/step-authentication'
import StepBranding from './steps/step-branding'
import StepPortalSettings from './steps/step-portal-settings'

const { Text } = Typography

const STEPS = [
  { description: __('Slug & URL'), title: __('Portal') },
  { description: __('Title & logo'), title: __('Branding') },
  { description: __('Login settings'), title: __('Auth') }
]

export default function Onboarding() {
  const [current, setCurrent] = useState(0)
  const navigate = useNavigate()
  const { completeOnboarding, isCompletingOnboarding } = useCompleteOnboarding()

  const handleFinish = async () => {
    await completeOnboarding()
    navigate('/general', { replace: true })
  }

  return (
    <div className="bc-min-h-screen bc-flex bc-items-center bc-justify-center bc-bg-surface-sunken bc-p-6">
      <div className="bc-w-full bc-max-w-2xl">
        <div className="bc-text-center bc-mb-8">
          <Typography.Title className="bc-mb-2" level={2}>
            {__('Welcome to Bit Connect')}
          </Typography.Title>
          <Text type="secondary">{__("Let's set up your community portal in a few steps.")}</Text>
        </div>

        <Card className="bc-shadow-sm">
          <Steps className="bc-mb-8" current={current} items={STEPS} size="small" />

          <div className="bc-min-h-64">
            {current === 0 && <StepPortalSettings onNext={() => setCurrent(1)} />}
            {current === 1 && <StepBranding onBack={() => setCurrent(0)} onNext={() => setCurrent(2)} />}
            {current === 2 && (
              <StepAuthentication
                isFinishing={isCompletingOnboarding}
                onBack={() => setCurrent(1)}
                onFinish={handleFinish}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
