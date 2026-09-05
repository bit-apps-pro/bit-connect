import { __ } from '@common/helpers/i18nWrap'
import { Alert, Button, InputNumber, Radio, Tabs, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'

import useSeoSettings from './data/use-seo-settings'
import useUpdateSeoSettings, { type ErrorResponse } from './data/use-update-seo-settings'
import ArchiveMatrix from './internal/archive-matrix'
import SeoSection from './internal/seo-section'
import SeoStatus from './internal/seo-status'
import { DEFAULT_SEO_SETTINGS, type MetaOwner, type SeoSettings } from './shared/types'

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

  const setArchive = useMemo(() => setGroup('archives'), [setGroup])
  const setIndexArchive = useMemo(() => setGroup('indexArchives'), [setGroup])
  const setSitemap = useMemo(() => setGroup('sitemap'), [setGroup])

  const setSitemapArchive = useCallback((segment: string, value: boolean) => {
    setIsDirty(true)
    setForm(previous => ({
      ...previous,
      sitemap: {
        ...previous.sitemap,
        archives: { ...previous.sitemap.archives, [segment]: value }
      }
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
          onChange={setToggle}
          subtitle={__(
            'The portal is a JavaScript app. Search engines and AI crawlers do not run it, so the server sends them plain HTML of the same content.'
          )}
          title={__('Content for crawlers')}
          toggles={[
            {
              description: __(
                'Render topics, replies and archives as plain HTML. Switching this off makes the portal invisible to anything that does not run JavaScript.'
              ),
              key: 'serverRendering',
              label: __('Server-rendered content'),
              value: form.serverRendering
            }
          ]}
        >
          <div className="bc-mt-4 bc-rounded-md bc-border bc-border-solid bc-border-line bc-p-4">
            <Typography.Text strong>{__('Topics per rendered page')}</Typography.Text>
            <p className="bc-mb-3 bc-mt-1 bc-text-sm bc-text-ink-muted">
              {__(
                'How many topics appear in the server-rendered list. Higher values make each page heavier for every visitor; older topics stay reachable through the sitemap and the older/newer links.'
              )}
            </p>
            <InputNumber
              disabled={disabled || !form.serverRendering}
              max={200}
              min={1}
              onChange={value => setField('ssrTopicLimit', Number(value ?? 30))}
              value={form.ssrTopicLimit}
            />
          </div>
        </SeoSection>
      ),
      key: 'crawling',
      label: __('Crawling')
    },
    {
      children: (
        <>
          <SeoSection
            disabled={disabled}
            subtitle={__(
              'Who prints the page title, canonical URL and social preview tags for portal routes.'
            )}
            title={__('Meta tags')}
          >
            <Radio.Group
              disabled={disabled}
              onChange={event => setField('metaOwner', event.target.value as MetaOwner)}
              value={form.metaOwner}
            >
              <div className="bc-flex bc-flex-col bc-gap-3">
                <Radio value="auto">
                  <span className="bc-font-medium">{__('Automatic (recommended)')}</span>
                  <div className="bc-text-sm bc-text-ink-muted">
                    {__(
                      'If an SEO plugin is active it prints the tags, using the portal data Bit Connect feeds it. Otherwise Bit Connect prints them.'
                    )}
                  </div>
                </Radio>
                <Radio value="bit-connect">
                  <span className="bc-font-medium">{__('Always Bit Connect')}</span>
                  <div className="bc-text-sm bc-text-ink-muted">
                    {__(
                      'Bit Connect prints the tags even when an SEO plugin is active. Use this if your SEO plugin is producing wrong tags on portal pages.'
                    )}
                  </div>
                </Radio>
                <Radio value="seo-plugin">
                  <span className="bc-font-medium">{__('Always my SEO plugin')}</span>
                  <div className="bc-text-sm bc-text-ink-muted">
                    {__(
                      'Bit Connect prints no tags of its own. If no supported SEO plugin is active, portal routes get no title or canonical at all.'
                    )}
                  </div>
                </Radio>
              </div>
            </Radio.Group>
          </SeoSection>

          <SeoSection
            disabled={disabled}
            onChange={setToggle}
            subtitle={__(
              'Machine-readable descriptions that let search engines show richer results for discussions.'
            )}
            title={__('Structured data')}
            toggles={[
              {
                description: __(
                  'Describe topics as forum discussions with their author, dates and replies, and lists as collections.'
                ),
                key: 'schemaDiscussion',
                label: __('Discussion and collection schema'),
                value: form.schemaDiscussion
              },
              {
                description: __(
                  'Show the community as the parent of each topic and archive in search results.'
                ),
                key: 'schemaBreadcrumbs',
                label: __('Breadcrumb schema'),
                value: form.schemaBreadcrumbs
              }
            ]}
          />
        </>
      ),
      key: 'meta',
      label: __('Meta & schema')
    },
    {
      children: (
        <SeoSection
          disabled={disabled}
          subtitle={__(
            'A page per term, listing its topics — the pages that can rank for a subject rather than for one question about it. Each row is one taxonomy: whether its archive is served, whether search engines may index it, and whether the sitemap lists it.'
          )}
          title={__('Term archives')}
        >
          <ArchiveMatrix
            diagnostics={diagnostics}
            disabled={disabled}
            form={form}
            onArchive={setArchive}
            onIndex={setIndexArchive}
            onSitemap={setSitemapArchive}
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
          onChange={setSitemap}
          subtitle={__(
            'How search engines discover the portal, including topics no page links to directly. Archive inclusion is set per taxonomy on the Archives tab.'
          )}
          title={__('Sitemap')}
          toggles={[
            {
              description: __(
                'Publish the portal sitemap at all. Switching this off removes the file and its robots.txt entry.'
              ),
              key: 'enabled',
              label: __('Portal sitemap'),
              value: form.sitemap.enabled
            },
            {
              description: __(
                'Announce the sitemap in robots.txt. This is how search engines find it without you submitting it, and it survives whichever SEO plugin owns the main sitemap.'
              ),
              disabled: !form.sitemap.enabled,
              key: 'inRobotsTxt',
              label: __('Announce in robots.txt'),
              value: form.sitemap.inRobotsTxt
            },
            {
              description: __('List the portal landing page as the entry point of the community.'),
              disabled: !form.sitemap.enabled,
              key: 'includeHome',
              label: __('Include portal home'),
              value: form.sitemap.includeHome
            },
            {
              description: __(
                'List every published topic. This is the main way deep topics get found, and switching it off usually means they will not be.'
              ),
              disabled: !form.sitemap.enabled,
              key: 'includeTopics',
              label: __('Include topics'),
              value: form.sitemap.includeTopics
            }
          ]}
        >
          <div className="bc-mt-4 bc-rounded-md bc-border bc-border-solid bc-border-line bc-p-4">
            <Typography.Text strong>{__('URLs per sitemap page')}</Typography.Text>
            <p className="bc-mb-3 bc-mt-1 bc-text-sm bc-text-ink-muted">
              {__(
                'Large communities are split across several sitemap pages. The sitemap standard allows up to 50,000 URLs per page; smaller pages are lighter to generate.'
              )}
            </p>
            <InputNumber
              disabled={disabled || !form.sitemap.enabled}
              max={50_000}
              min={100}
              onChange={value =>
                setForm(previous => {
                  setIsDirty(true)
                  return {
                    ...previous,
                    sitemap: { ...previous.sitemap, urlsPerPage: Number(value ?? 2000) }
                  }
                })
              }
              step={500}
              value={form.sitemap.urlsPerPage}
            />
          </div>
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
