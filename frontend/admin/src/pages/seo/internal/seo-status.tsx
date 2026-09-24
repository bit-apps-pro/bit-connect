import { __, sprintf } from '@common/helpers/i18nWrap'
import { Alert, Descriptions, Tag, Typography } from 'antd'

import { SEO_PLUGIN_LABELS, type SeoDiagnostics } from '../shared/types'

const { Title } = Typography

/**
 * What is actually live, as opposed to what has been asked for.
 *
 * Every value here is read from the running site, not from the form — an
 * administrator otherwise has no way to tell whether their SEO plugin is
 * winning, whether crawlers can see the portal at all, or how much of the
 * community is indexable.
 */
export default function SeoStatus({ diagnostics }: { diagnostics: SeoDiagnostics }) {
  const pluginLabel = diagnostics.seoPlugin
    ? (SEO_PLUGIN_LABELS[diagnostics.seoPlugin] ?? diagnostics.seoPlugin)
    : __('None detected')

  // Every portal page that goes to search, counted the way the sitemap lists
  // them: the landing page, each topic, and each archive shown in search.
  const archivePageCount = Object.values(diagnostics.archives)
    .filter(archive => archive.indexable)
    .reduce((total, archive) => total + archive.terms, 0)

  return (
    <div className="bc-mb-6 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-6">
      <Title className="bc-mb-4" level={4}>
        {__('Status')}
      </Title>

      {!diagnostics.portalIsPublic && (
        <Alert
          className="bc-mb-4"
          description={__(
            'The portal is restricted to logged-in members, so nothing is exposed to search engines. These settings take effect once the portal is public.'
          )}
          message={__('Portal is members-only')}
          showIcon
          type="warning"
        />
      )}

      {diagnostics.portalIsPublic && diagnostics.searchEnginesDiscouraged && (
        <Alert
          className="bc-mb-4"
          description={__(
            'WordPress is set to discourage search engines (Settings → Reading), so the portal sitemap is not published and nothing is announced in robots.txt.'
          )}
          message={__('Search engines are discouraged')}
          showIcon
          type="warning"
        />
      )}

      {diagnostics.portalIsPublic && !diagnostics.crawlerContent && (
        <Alert
          className="bc-mb-4"
          description={__(
            'Custom code on this site has switched off the plain HTML sent to search engines and AI crawlers, so they cannot read the portal or its titles and link previews.'
          )}
          message={__('Content for crawlers is switched off')}
          showIcon
          type="warning"
        />
      )}

      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label={__('SEO plugin detected')}>
          <span className="bc-font-medium">{pluginLabel}</span>
          {diagnostics.seoPlugin && (
            <Tag className="bc-ml-2" color="blue">
              {__('It handles the rest of the site; Bit Connect describes portal pages')}
            </Tag>
          )}
        </Descriptions.Item>

        <Descriptions.Item label={__('Portal URL')}>
          <a href={diagnostics.portalUrl} rel="noreferrer" target="_blank">
            {diagnostics.portalUrl || '—'}
          </a>
        </Descriptions.Item>

        <Descriptions.Item label={__('Sitemap')}>
          {diagnostics.sitemapUrl ? (
            <>
              <a href={diagnostics.sitemapUrl} rel="noreferrer" target="_blank">
                {diagnostics.sitemapUrl}
              </a>
              <p className="bc-mb-0 bc-mt-1 bc-text-sm bc-text-ink-muted">
                {__(
                  'Submit this to Google Search Console. It is an index: one sitemap for the topics, then one per taxonomy shown in search. It is also announced in robots.txt.'
                )}
              </p>
            </>
          ) : (
            '—'
          )}
        </Descriptions.Item>

        {diagnostics.sitemapUrl && (
          <Descriptions.Item label={__('In the sitemap')}>
            <span className="bc-font-medium">
              {sprintf(
                // translators: 1: number of topics, 2: number of archive pages.
                __('1 home page · %1$s topics · %2$s archive pages'),
                diagnostics.publishedTopics,
                archivePageCount
              )}
            </span>
          </Descriptions.Item>
        )}
      </Descriptions>
    </div>
  )
}
