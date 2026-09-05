import { __ } from '@common/helpers/i18nWrap'
import useCheckSlug from '@pages/general/data/use-check-slug'
import useCreatePortalPage from '@pages/general/data/use-create-portal-page'
import useUpdatePortalRoot from '@pages/general/data/use-update-portal-root'
import SlugStatus from '@pages/general/internal/slug-status'
import { Alert, Button, Card, Input, Space, Typography } from 'antd'
import { useState } from 'react'
import { LuGlobe, LuHouse } from 'react-icons/lu'

const { Text, Title } = Typography

type Placement = 'site_root' | 'slug'

interface Props {
  onNext: () => void
}

/**
 * Where the portal will live: under a slug, or at the site root.
 *
 * Either way a page is created — root mode hangs off one too, it just hides
 * the slug from the URL. The slug is checked live so the administrator sees
 * a conflict before pressing Next, and the page is only created here, once:
 * from then on the settings screen treats the slug as a pointer.
 */
const cardClass = (active: boolean) =>
  `bc-cursor-pointer bc-transition-all ${active ? 'bc-border-blue-500 bc-shadow-sm' : ''}`

export default function StepPortalSettings({ onNext }: Props) {
  const [placement, setPlacement] = useState<Placement>('slug')
  const [slug, setSlug] = useState('portal')
  const [error, setError] = useState('')

  const { check, isChecking } = useCheckSlug(slug)
  const { createPortalPage, isCreatingPortalPage } = useCreatePortalPage()
  const { isUpdatingPortalRoot, updatePortalRoot } = useUpdatePortalRoot()

  const taken = check?.exists === true
  const isNextDisabled = slug.trim().length < 1 || isChecking || !check || taken

  const handleNext = async () => {
    const trimmed = slug.trim()

    try {
      await createPortalPage(trimmed)
    } catch (error_: unknown) {
      setError(
        (error_ as { message?: string })?.message ?? __('Could not create the page. Please try again.')
      )
      return
    }

    if (placement === 'site_root') {
      try {
        await updatePortalRoot(true)
      } catch {
        setError(
          __(
            'The page was created, but it could not be set as your homepage. You can turn that on later in Settings.'
          )
        )
        return
      }
    }

    onNext()
  }

  return (
    <div className="bc-flex bc-flex-col bc-gap-6">
      <div>
        <Title className="bc-mb-1" level={4}>
          {__('Where should your community live?')}
        </Title>
        <Text type="secondary">
          {__('We will create a page for it. You can change this later in Settings.')}
        </Text>
      </div>

      <div className="bc-flex bc-flex-col bc-gap-3">
        <Card className={cardClass(placement === 'slug')} onClick={() => setPlacement('slug')}>
          <div className="bc-flex bc-items-start bc-gap-3">
            <LuGlobe className="bc-mt-0.5 bc-shrink-0 bc-text-blue-500" size={20} />
            <div>
              <Text strong>{__('On its own page')}</Text>
              <Text className="bc-mt-0.5 bc-block bc-text-sm" type="secondary">
                {__('yoursite.com/community — the rest of your website stays as it is. Recommended.')}
              </Text>
            </div>
          </div>
        </Card>

        <Card className={cardClass(placement === 'site_root')} onClick={() => setPlacement('site_root')}>
          <div className="bc-flex bc-items-start bc-gap-3">
            <LuHouse className="bc-mt-0.5 bc-shrink-0 bc-text-blue-500" size={20} />
            <div className="bc-w-full">
              <Text strong>{__('As the homepage')}</Text>
              <Text className="bc-mt-0.5 bc-block bc-text-sm" type="secondary">
                {__('yoursite.com — the community is the first thing visitors see.')}
              </Text>
              {placement === 'site_root' && (
                <Alert
                  className="bc-mt-3"
                  description={__(
                    'Your current homepage is replaced, and topic links use the site root (yoursite.com/topic-name). Best for a site that is only the community.'
                  )}
                  message={__('This replaces your homepage')}
                  showIcon
                  type="warning"
                />
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="bc-flex bc-flex-col bc-gap-2">
        <Text strong>
          {placement === 'slug' ? __('Address slug') : __('Page name')}
          <span className="bc-text-red-500"> *</span>
        </Text>
        <Input
          addonBefore="/"
          onChange={e => {
            setSlug(e.target.value)
            setError('')
          }}
          placeholder={__('e.g. community')}
          status={error || taken ? 'error' : ''}
          value={slug}
        />
        {error ? (
          <Text className="bc-block" type="danger">
            {error}
          </Text>
        ) : (
          <SlugStatus check={check} isChecking={isChecking} mode="create" />
        )}
        {placement === 'site_root' && (
          <Text className="bc-block bc-text-sm" type="secondary">
            {__('Only used as the page name in WordPress — visitors see yoursite.com.')}
          </Text>
        )}
      </div>

      <div className="bc-flex bc-flex-col bc-gap-2">
        <Text strong>{__('Want to use your own page instead?')}</Text>
        <Input.Search
          enterButton={__('Copy')}
          onSearch={e => navigator.clipboard?.writeText(e)}
          readOnly
          value="[bit-connect]"
        />
        <Text className="bc-block bc-text-sm" type="secondary">
          {__(
            'Skip this step, paste the shortcode into any page you like, and publish it. That page becomes your community.'
          )}
        </Text>
      </div>

      <Space className="bc-justify-end">
        <Button onClick={onNext}>{__('Skip')}</Button>
        <Button
          disabled={isNextDisabled}
          loading={isCreatingPortalPage || isUpdatingPortalRoot}
          onClick={handleNext}
          type="primary"
        >
          {__('Create page and continue')}
        </Button>
      </Space>
    </div>
  )
}
