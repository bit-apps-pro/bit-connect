import { __ } from '@common/helpers/i18nWrap'
import { Alert, Button, Typography } from 'antd'
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
  const { diagnostics, isSeoSettingsPending, seoSettings } = useSeoSettings()
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
      <div className="bc-mb-4 bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-3">
        <div>
          <Title className="bc-mb-1" level={3}>
            {__('SEO')}
          </Title>
          <Typography.Text type="secondary">
            {__(
              'How the portal presents itself to search engines, AI crawlers and link previews. Bit Connect handles this itself — an SEO plugin cannot see portal routes.'
            )}
          </Typography.Text>
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
          className="bc-mb-4"
          message={(error as ErrorResponse)?.errors?.message ?? __('Failed to update SEO settings')}
          showIcon
          type="error"
        />
      )}

      <SeoStatus diagnostics={diagnostics} />

      <SeoSection
        subtitle={__(
          'A page per term, listing its topics — the pages that can rank for a subject rather than for one question about it. Switched on, a taxonomy’s archives are indexed and listed in the sitemap. Switched off, they still work for visitors but are hidden from search.'
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
  )
}
