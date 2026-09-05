import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

import {
  DEFAULT_SEO_SETTINGS,
  type SeoDiagnostics,
  type SeoSettings,
  type SeoSettingsResponse
} from '../shared/types'

const EMPTY_DIAGNOSTICS: SeoDiagnostics = {
  archives: {},
  crawlerContent: false,
  isBridged: false,
  portalIsPublic: false,
  portalUrl: '',
  publishedTopics: 0,
  seoPlugin: '',
  sitemapUrl: ''
}

export default function useSeoSettings() {
  const { data, isError, isFetching, isPending, refetch } = useQuery<
    ResponseType<SeoSettingsResponse>,
    Error,
    SeoSettingsResponse
  >({
    queryFn: ({ signal }) =>
      request<never, SeoSettingsResponse>('seo-settings', { method: 'GET', signal }),
    queryKey: ['seo-settings'],
    retry: false,
    select: response => {
      const payload = response?.data ?? (response as unknown as SeoSettingsResponse)

      return {
        // Merged over the defaults so a payload saved before a setting existed
        // renders that control in its default position rather than unchecked.
        diagnostics: { ...EMPTY_DIAGNOSTICS, ...payload?.diagnostics },
        settings: {
          ...DEFAULT_SEO_SETTINGS,
          ...payload?.settings,
          archives: { ...DEFAULT_SEO_SETTINGS.archives, ...payload?.settings?.archives },
          indexArchives: {
            ...DEFAULT_SEO_SETTINGS.indexArchives,
            ...payload?.settings?.indexArchives
          },
          sitemap: {
            ...DEFAULT_SEO_SETTINGS.sitemap,
            ...payload?.settings?.sitemap,
            archives: {
              ...DEFAULT_SEO_SETTINGS.sitemap.archives,
              ...payload?.settings?.sitemap?.archives
            }
          }
        } as SeoSettings
      }
    }
  })

  return {
    diagnostics: data?.diagnostics ?? EMPTY_DIAGNOSTICS,
    isSeoSettingsError: isError,
    isSeoSettingsFetching: isFetching,
    isSeoSettingsPending: isPending,
    refetchSeoSettings: refetch,
    seoSettings: data?.settings ?? DEFAULT_SEO_SETTINGS
  }
}
