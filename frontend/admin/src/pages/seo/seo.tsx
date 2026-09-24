import { __ } from '@common/helpers/i18nWrap'
import { Alert, Button, Tabs, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import useSeoSettings from './data/use-seo-settings'
import useUpdateSeoSettings, { type ErrorResponse } from './data/use-update-seo-settings'
import ArchiveRows, { type ArchiveVisibility, VISIBILITY_FLAGS } from './internal/archive-rows'
import SeoFieldRows from './internal/seo-field-rows'
import SeoSection from './internal/seo-section'
import SeoStatus from './internal/seo-status'
import SitemapUrlNotice from './internal/sitemap-url-notice'
import { type ArchiveSegment, DEFAULT_SEO_SETTINGS, type SeoSettings } from './shared/types'

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

  const setField = useCallback(<K extends keyof SeoSettings>(key: K, value: SeoSettings[K]) => {
    setIsDirty(true)
    setForm(previous => ({ ...previous, [key]: value }))
  }, [])

  const setToggle = useCallback(
    (key: string, value: boolean) => setField(key as keyof SeoSettings, value as never),
    [setField]
  )

  /** Setter for one key inside a nested group (archives, indexArchives, sitemap). */
  const setGroup = useCallback(
    (group: 'archives' | 'indexArchives' | 'sitemap') => (key: string, value: boolean) => {
      setIsDirty(true)
      setForm(previous => ({
        ...previous,
        [group]: { ...previous[group], [key]: value }
      }))
    },
    []
  )

  const setSitemap = useMemo(() => setGroup('sitemap'), [setGroup])

  /**
   * One taxonomy's archive visibility, written across the three flags it maps
   * to. Set together rather than one at a time: the three are a chain, and the
   * combinations that are not on it are ones the backend refuses to honour.
   */
  const setArchiveVisibility = useCallback((segment: ArchiveSegment, visibility: ArchiveVisibility) => {
    const flags = VISIBILITY_FLAGS[visibility]

    setIsDirty(true)
    setForm(previous => ({
      ...previous,
      archives: { ...previous.archives, [segment]: flags.route },
      indexArchives: { ...previous.indexArchives, [segment]: flags.index },
      sitemap: {
        ...previous.sitemap,
        archives: { ...previous.sitemap.archives, [segment]: flags.sitemap }
      }
    }))
  }, [])

  const setSitemapUrlsPerPage = useCallback((value: number) => {
    setIsDirty(true)
    setForm(previous => ({
      ...previous,
      sitemap: { ...previous.sitemap, urlsPerPage: value }
    }))
  }, [])

  const onSave = useCallback(async () => {
    await updateSeoSettings(form)
    setIsDirty(false)
  }, [form, updateSeoSettings])

  const disabled = isSeoSettingsPending || isUpdatingSeoSettings

  const tabs = [
    {
      children: <SeoStatus diagnostics={diagnostics} />,
      key: 'overview',
      label: __('Overview')
    },
    {
      children: (
        <SeoSection
          disabled={disabled}
          subtitle={__(
            'A page per term, listing its topics — the pages that can rank for a subject rather than for one question about it. Each step below adds to the one before it: an archive has to be served to be indexed, and indexed to be worth listing in the sitemap.'
          )}
          title={__('Term archives')}
        >
          <ArchiveRows
            diagnostics={diagnostics}
            disabled={disabled}
            form={form}
            onChange={setArchiveVisibility}
          />
        </SeoSection>
      ),
      key: 'archives',
      label: __('Archives')
    },
    {
      children: (
        <SeoSection
          disabled={disabled}
          onChange={setToggle}
          subtitle={__(
            'These routes always work for visitors. Indexing them puts thin, near-identical pages in front of the topics they link to, so they are excluded by default.'
          )}
          title={__('What search engines may index')}
          toggles={[
            {
              description: __(
                'Member profile pages. These are thin and similar to one another, and indexing them publishes member names and activity.'
              ),
              key: 'indexProfiles',
              label: __('Index member profiles'),
              value: form.indexProfiles
            },
            {
              description: __(
                'Pages 2, 3, … of the topic list. They exist so crawlers can reach older topics, not to rank themselves.'
              ),
              key: 'indexPagination',
              label: __('Index paginated list pages'),
              value: form.indexPagination
            }
          ]}
        />
      ),
      key: 'indexing',
      label: __('Indexing')
    },
    {
      children: (
        <SeoSection
          disabled={disabled}
          subtitle={__(
            'How search engines discover the portal, including topics no page links to directly. Archive inclusion is set per taxonomy on the Archives tab.'
          )}
          title={__('Sitemap')}
        >
          <SitemapUrlNotice enabled={form.sitemap.enabled} url={diagnostics.sitemapUrl} />

          <SeoFieldRows
            disabled={disabled}
            fields={[
              {
                control: 'switch',
                description: __(
                  'Publish the portal sitemap at all. Switching this off removes the file and its robots.txt entry.'
                ),
                key: 'enabled',
                label: __('Portal sitemap'),
                onChange: value => setSitemap('enabled', value),
                value: form.sitemap.enabled
              },
              {
                control: 'switch',
                description: __(
                  'Announce the sitemap in robots.txt. This is how search engines find it without you submitting it, and it survives whichever SEO plugin owns the main sitemap.'
                ),
                disabled: !form.sitemap.enabled,
                key: 'inRobotsTxt',
                label: __('Announce in robots.txt'),
                onChange: value => setSitemap('inRobotsTxt', value),
                value: form.sitemap.inRobotsTxt
              },
              {
                control: 'switch',
                description: __('List the portal landing page as the entry point of the community.'),
                disabled: !form.sitemap.enabled,
                key: 'includeHome',
                label: __('Include portal home'),
                onChange: value => setSitemap('includeHome', value),
                value: form.sitemap.includeHome
              },
              {
                control: 'switch',
                description: __(
                  'List every published topic. This is the main way deep topics get found, and switching it off usually means they will not be.'
                ),
                disabled: !form.sitemap.enabled,
                key: 'includeTopics',
                label: __('Include topics'),
                onChange: value => setSitemap('includeTopics', value),
                value: form.sitemap.includeTopics
              },
              {
                control: 'number',
                description: __(
                  'Each content type gets its own sitemap, split across numbered pages once it holds more URLs than this. The sitemap standard allows up to 50,000 per page; smaller pages are lighter to generate.'
                ),
                disabled: !form.sitemap.enabled,
                fallback: DEFAULT_SEO_SETTINGS.sitemap.urlsPerPage,
                key: 'urlsPerPage',
                label: __('URLs per sitemap page'),
                max: 50_000,
                min: 100,
                onChange: setSitemapUrlsPerPage,
                step: 500,
                value: form.sitemap.urlsPerPage
              }
            ]}
          />
        </SeoSection>
      ),
      key: 'sitemap',
      label: __('Sitemap')
    }
  ]

  return (
    <div className="bc-p-6">
      {/* Save sits with the heading rather than after the tabs: the tabs mean
          any given edit may be several panels away from wherever the button
          lands otherwise, and edits made on one tab have to stay savable from
          another. */}
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

      <Tabs items={tabs} />
    </div>
  )
}
