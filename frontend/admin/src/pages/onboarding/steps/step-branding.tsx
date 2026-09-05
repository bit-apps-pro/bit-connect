import { __ } from '@common/helpers/i18nWrap'
import { useWpMediaModal } from '@components/hooks/use-wp-media-modal'
import useGeneralSettings from '@pages/general/data/use-general-settings'
import useUpdateGeneralSettings from '@pages/general/data/use-update-general-settings'
import { type GeneralSettings, type PortalAccess } from '@pages/general/shared/types'
import { Button, Input, Radio, Select, Skeleton, Space, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'

const { Text, Title } = Typography

interface Props {
  onBack: () => void
  onNext: () => void
}

export default function StepBranding({ onBack, onNext }: Props) {
  const { generalSettings, isGeneralSettingsFetching } = useGeneralSettings()
  const { isUpdatingGeneralSettings, updateGeneralSettings } = useUpdateGeneralSettings()
  const [form, setForm] = useState<GeneralSettings>(generalSettings)
  const { openMediaModal } = useWpMediaModal()

  useEffect(() => {
    setForm(generalSettings)
  }, [generalSettings])

  const patch = useCallback((values: Partial<GeneralSettings>) => {
    setForm(prev => ({ ...prev, ...values }))
  }, [])

  const handleUploadLogo = useCallback(() => {
    openMediaModal({
      library: { type: 'image' },
      onSelect: ({ url }: { url: string }) => patch({ logoLight: url })
    })
  }, [openMediaModal, patch])

  const handleNext = async () => {
    await updateGeneralSettings(form)
    onNext()
  }

  if (isGeneralSettingsFetching) {
    return <Skeleton active paragraph={{ rows: 6 }} />
  }

  return (
    <div className="bc-flex bc-flex-col bc-gap-6">
      <div>
        <Title className="bc-mb-1" level={4}>
          {__('Branding & Access')}
        </Title>
        <Text type="secondary">
          {__('Set your community title, logo, and who can access the portal.')}
        </Text>
      </div>

      <div className="bc-flex bc-flex-col bc-gap-5">
        <div>
          <Text className="bc-block bc-mb-2" strong>
            {__('Community Title')}
          </Text>
          <Input
            onChange={e => patch({ communityTitle: e.target.value })}
            placeholder={__('My Community')}
            value={form.communityTitle}
          />
        </div>

        <div>
          <Text className="bc-block bc-mb-2" strong>
            {__('Logo')}
          </Text>
          <Space className="bc-w-full" direction="vertical">
            <Input
              addonAfter={
                <Button onClick={handleUploadLogo} size="small" type="link">
                  {__('Upload')}
                </Button>
              }
              onChange={e => patch({ logoLight: e.target.value })}
              placeholder={__('https://example.com/logo.png')}
              value={form.logoLight}
            />
          </Space>
        </div>

        <div>
          <Text className="bc-block bc-mb-2" strong>
            {__('Logo Link')}
          </Text>
          <Select
            className="bc-w-full"
            onChange={val => patch({ logoPermalinkMode: val })}
            options={[
              { label: __('Default (portal home)'), value: 'default' },
              { label: __('Custom URL'), value: 'custom' }
            ]}
            value={form.logoPermalinkMode}
          />
          {form.logoPermalinkMode === 'custom' && (
            <Input
              className="bc-mt-2"
              onChange={e => patch({ logoPermalinkCustom: e.target.value })}
              placeholder="https://"
              value={form.logoPermalinkCustom}
            />
          )}
        </div>

        <div>
          <Text className="bc-block bc-mb-2" strong>
            {__('Portal Access')}
          </Text>
          <Radio.Group
            onChange={e => patch({ portalAccess: e.target.value as PortalAccess })}
            value={form.portalAccess}
          >
            <Radio value="everyone">{__('Everyone')}</Radio>
            <Radio value="logged_in">{__('Logged-in users only')}</Radio>
          </Radio.Group>
        </div>
      </div>

      <Space className="bc-justify-between">
        <Button onClick={onBack}>{__('Back')}</Button>
        <Button loading={isUpdatingGeneralSettings} onClick={handleNext} type="primary">
          {__('Next')}
        </Button>
      </Space>
    </div>
  )
}
