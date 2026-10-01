import { __ } from '@common/helpers/i18nWrap'
import { Alert, Button, Skeleton, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'

import useSeoSettings from './data/use-seo-settings'
import useUpdateSeoSettings, { type ErrorResponse } from './data/use-update-seo-settings'
import ArchiveRows from './internal/archive-rows'
import SeoFieldRows from './internal/seo-field-rows'
import SeoSection from './internal/seo-section'
import SeoStatus from './internal/seo-status'
import { DEFAULT_SEO_SETTINGS, type SeoSettings } from './shared/types'

const { Title } = Typography

export default function Seo() {
  const { diagnostics, hasSeoSettings, isSeoSettingsError, isSeoSettingsPending, refetchSeoSettings, seoSettings } =
    useSeoSettings()
  const { error, isError, isUpdatingSeoSettings, updateSeoSettings } = useUpdateSeoSettings()

  const [form, setForm] = useState<SeoSettings>(DEFAULT_SEO_SETTINGS)
  const [isDirty, setIsDirty] = useState(false)

  // The saved settings are the source of truth until the form is touched;
  // adopting them afterwards would discard edits made while the refetch that
  // follows a save was still in flight.
  useEffect(() => {
    if (!isDirty) setForm(seoSettings)
  }, [seoSettings, isDirty])

  const setIndexProfiles = useCallback((value: boolean) => {
    setIsDirty(true)
    setForm(previous => ({ ...previous, indexProfiles: value }))
  }, [])

  const setArchiveIndexable = useCallback((segment: string, value: boolean) => {
    setIsDirty(true)
    setForm(previous => ({
      ...previous,
      indexArchives: { ...previous.indexArchives, [segment]: value }
    }))
  }, [])

  const onSave = useCallback(async () => {
    await updateSeoSettings(form)
    setIsDirty(false)
  }, [form, updateSeoSettings])

  const disabled = isSeoSettingsPending || isUpdatingSeoSettings

  return (
    <div className="bc-p-6">
      {/* One page rather than tabs: what is left is a status card and six
          switches, and tabs only put the switches a click away from the Save
          button that governs them. */}
      <div className="bc-mb-5 bc-flex bc-flex-wrap bc-items-end bc-justify-between bc-gap-4">
        <div className="bc-min-w-0 bc-flex-1 bc-basis-80">
          <Title className="bc-mb-0" level={3}>
            {__('SEO')}
          </Title>
        </div>

        <div className="bc-flex bc-shrink-0 bc-items-center bc-gap-3">
          {isDirty && <Typography.Text type="secondary">{__('Unsaved changes')}</Typography.Text>}
          <Button
            disabled={!isDirty}
            loading={isUpdatingSeoSettings}
            onClick={onSave}
            size="large"
            type="primary"
          >
            {__('Save')}
          </Button>
        </div>
      </div>

      {isError && (
        <Alert
          className="bc-mb-5"
          message={(error as ErrorResponse)?.errors?.message ?? __('Failed to update SEO settings')}
          showIcon
          type="error"
        />
      )}

      {/* Until the settings arrive the page has nothing true to say: drawn
          from the empty defaults, the status card would warn that the portal
          is members-only and every switch would sit in the wrong place. */}
      {!hasSeoSettings && !isSeoSettingsError && (
        <div aria-busy className="bc-flex bc-flex-col bc-gap-5">
          {[4, 5, 2].map((rows, index) => (
            <div
              className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-6 bc-py-5"
              key={index}
            >
              <Skeleton active paragraph={{ rows }} title={{ width: '25%' }} />
            </div>
          ))}
        </div>
      )}

      {!hasSeoSettings && isSeoSettingsError && (
        <Alert
          action={
            <Button onClick={() => refetchSeoSettings()} size="small">
              {__('Retry')}
            </Button>
          }
          message={__('SEO settings could not be loaded.')}
          showIcon
          type="error"
        />
      )}

      {hasSeoSettings && (
        <div className="bc-flex bc-flex-col bc-gap-5">
      <SeoStatus diagnostics={diagnostics} />

      <SeoSection
        subtitle={__(
          'Each term gets a page that lists its topics. These pages can rank for a whole subject, not just one question. When on, a taxonomy’s archives are indexed and added to the sitemap. When off, visitors can still open them, but search engines won’t see them.'
        )}
        title={__('Term archives')}
      >
        <ArchiveRows
          diagnostics={diagnostics}
          disabled={disabled}
          form={form}
          onChange={setArchiveIndexable}
        />
      </SeoSection>

      <SeoSection
        subtitle={__(
          'Profile pages always work for visitors. Indexing them puts member names and activity in search results, so it is off until you choose it.'
        )}
        title={__('Member profiles')}
      >
        <SeoFieldRows
          disabled={disabled}
          fields={[
            {
              control: 'switch',
              description: __(
                'Show member profile pages in search results, each with its own title, description and canonical address.'
              ),
              key: 'indexProfiles',
              label: __('Show profiles in search'),
              onChange: setIndexProfiles,
              value: form.indexProfiles
            }
          ]}
        />
      </SeoSection>
        </div>
      )}
    </div>
  )
}
