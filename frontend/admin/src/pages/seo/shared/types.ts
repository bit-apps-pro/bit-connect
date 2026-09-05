/** Which component prints title, canonical and the social tags. */
export type MetaOwner = 'auto' | 'bit-connect' | 'seo-plugin'

/** URL segment of each term archive. Mirrors PortalTaxonomies::map(). */
export type ArchiveSegment = 'department' | 'stage' | 'status' | 'tag' | 'topic'

export type ArchiveToggles = Record<ArchiveSegment, boolean>

/** What the sitemap advertises, content type by content type. */
export interface SitemapSettings {
  /** Which taxonomies' archives are listed. */
  archives: ArchiveToggles
  enabled: boolean
  includeHome: boolean
  includeTopics: boolean
  inRobotsTxt: boolean
  urlsPerPage: number
}

export interface SeoSettings {
  /** Which archive routes are served at all. */
  archives: ArchiveToggles
  /** Which of the served archives may be indexed. */
  indexArchives: ArchiveToggles
  indexPagination: boolean
  indexProfiles: boolean
  metaOwner: MetaOwner
  schemaBreadcrumbs: boolean
  schemaDiscussion: boolean
  serverRendering: boolean
  sitemap: SitemapSettings
  ssrTopicLimit: number
}

/**
 * Read-only facts about what is actually live, so the screen can be honest
 * rather than only showing what was asked for.
 */
export interface SeoDiagnostics {
  archives: Record<string, { indexable: boolean; terms: number }>
  crawlerContent: boolean
  isBridged: boolean
  portalIsPublic: boolean
  portalUrl: string
  publishedTopics: number
  /** '' when no supported SEO plugin is active. */
  seoPlugin: '' | 'aioseo' | 'rankmath' | 'seopress' | 'yoast'
  sitemapUrl: string
}

export interface SeoSettingsResponse {
  diagnostics: SeoDiagnostics
  settings: SeoSettings
}

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  archives: { department: true, stage: true, status: true, tag: true, topic: true },
  indexArchives: { department: true, stage: false, status: false, tag: true, topic: true },
  indexPagination: false,
  indexProfiles: false,
  metaOwner: 'auto',
  schemaBreadcrumbs: true,
  schemaDiscussion: true,
  serverRendering: true,
  sitemap: {
    archives: { department: true, stage: true, status: true, tag: true, topic: true },
    enabled: true,
    includeHome: true,
    includeTopics: true,
    inRobotsTxt: true,
    urlsPerPage: 2000
  },
  ssrTopicLimit: 30
}

export const SEO_PLUGIN_LABELS: Record<string, string> = {
  aioseo: 'All in One SEO',
  rankmath: 'Rank Math',
  seopress: 'SEOPress',
  yoast: 'Yoast SEO'
}
