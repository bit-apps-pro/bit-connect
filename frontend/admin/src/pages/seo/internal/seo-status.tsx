import { __, sprintf } from '@common/helpers/i18nWrap'
import { Alert } from 'antd'

import { type SeoDiagnostics } from '../shared/types'
import SeoSection from './seo-section'

/** One fact: a caption on the left, the value beside it. */
function StatusRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="bc-grid bc-gap-1 bc-border-0 bc-border-t bc-border-solid bc-border-t-line bc-py-3.5 sm:bc-grid-cols-[11rem_1fr] sm:bc-gap-4">
      <div className="bc-text-xs bc-font-medium bc-text-ink-muted sm:bc-pt-0.5">{label}</div>
      <div className="bc-min-w-0 bc-break-words bc-text-sm bc-text-ink">{children}</div>
    </div>
  )
}

/**
 * What is actually live, as opposed to what has been asked for.
 *
 * Every value here is read from the running site, not from the form — an
 * administrator otherwise has no way to tell whether crawlers can see the
 * portal at all, or how much of the community is indexable.
 */
export default function SeoStatus({ diagnostics }: { diagnostics: SeoDiagnostics }) {
  // Every portal page that goes to search, counted the way the sitemap lists
  // them: the landing page, each topic, and each archive shown in search.
  const archivePageCount = Object.values(diagnostics.archives)
    .filter(archive => archive.indexable)
    .reduce((total, archive) => total + archive.terms, 0)

  return (
    <SeoSection
      subtitle={__('What is live on the site right now, read from the site itself.')}
      title={__('Status')}
    >

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

      <div>
        <StatusRow label={__('Portal URL')}>
          <a href={diagnostics.portalUrl} rel="noreferrer" target="_blank">
            {diagnostics.portalUrl || '—'}
          </a>
        </StatusRow>

        <StatusRow label={__('Sitemap')}>
          {diagnostics.sitemapUrl ? (
            <>
              <a href={diagnostics.sitemapUrl} rel="noreferrer" target="_blank">
                {diagnostics.sitemapUrl}
              </a>
              <p className="bc-mb-0 bc-mt-1 bc-text-xs bc-text-ink-subtle">
                {__(
                  'Submit this to Google Search Console. It is an index: one sitemap for the topics, then one per taxonomy shown in search. It is also announced in robots.txt.'
                )}
              </p>
            </>
          ) : (
            '—'
          )}
        </StatusRow>

        {diagnostics.sitemapUrl && (
          <StatusRow label={__('In the sitemap')}>
            <span className="bc-font-medium">
              {sprintf(
                // translators: 1: number of topics, 2: number of archive pages.
                __('1 home page · %1$s topics · %2$s archive pages'),
                diagnostics.publishedTopics,
                archivePageCount
              )}
            </span>
          </StatusRow>
        )}
      </div>
    </SeoSection>
  )
}
