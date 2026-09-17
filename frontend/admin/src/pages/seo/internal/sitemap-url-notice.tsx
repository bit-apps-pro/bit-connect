import { __ } from '@common/helpers/i18nWrap'
import { Alert, Typography } from 'antd'

const { Text } = Typography

interface SitemapUrlNoticeProps {
  /** The form's current value, not the saved one — the link is wrong before a save. */
  enabled: boolean
  url: string
}

/**
 * Where the sitemap actually is, at the top of the sitemap settings.
 *
 * Rank Math, Yoast and AIOSEO all open this screen with the sitemap's own URL
 * as a link, because the first thing an administrator wants from these settings
 * is to look at the result. The URL was reachable only from the Overview tab,
 * which is also the one place it was shown while the sitemap was switched off —
 * a link to a 404.
 */
export default function SitemapUrlNotice({ enabled, url }: SitemapUrlNoticeProps) {
  if (url === '') {
    return
  }

  if (!enabled) {
    return (
      <Alert
        className="bc-mb-4"
        message={__(
          'The portal sitemap is off. Its URL returns “not found” and nothing is announced in robots.txt.'
        )}
        showIcon
        type="warning"
      />
    )
  }

  return (
    <div className="bc-mb-4 bc-rounded-md bc-bg-surface-sunken bc-p-4">
      <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-2">
        <Text strong>{__('Your portal sitemap:')}</Text>
        <a href={url} rel="noreferrer" target="_blank">
          {url}
        </a>
      </div>
      <p className="bc-mb-0 bc-mt-1 bc-text-sm bc-text-ink-muted">
        {__(
          'Submit this to Google Search Console. It is an index: one sitemap per content type — the topics, then each taxonomy’s archives — so you can see at a glance what is listed.'
        )}
      </p>
    </div>
  )
}
