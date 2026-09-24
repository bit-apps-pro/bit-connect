/** URL segment of each term archive. Mirrors PortalTaxonomies::map(). */
export type ArchiveSegment = 'department' | 'stage' | 'status' | 'tag' | 'topic'

export type ArchiveToggles = Record<ArchiveSegment, boolean>

export interface SeoSettings {
  /**
   * Which archives are offered to search — indexed and in the sitemap. Every
   * archive is served to visitors either way.
   */
  indexArchives: ArchiveToggles
  indexProfiles: boolean
}

/**
 * Read-only facts about what is actually live, so the screen can be honest
 * rather than only showing what was asked for.
 */
export interface SeoDiagnostics {
  archives: Record<string, { indexable: boolean; terms: number }>
  crawlerContent: boolean
  portalIsPublic: boolean
  portalUrl: string
  publishedTopics: number
  /** WordPress's "Discourage search engines" is on. */
  searchEnginesDiscouraged: boolean
  /** '' when no supported SEO plugin is active. */
  seoPlugin: '' | 'aioseo' | 'rankmath' | 'seopress' | 'yoast'
  /** '' when the sitemap is not being served. */
  sitemapUrl: string
}

export interface SeoSettingsResponse {
  diagnostics: SeoDiagnostics
  settings: SeoSettings
}

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  // Mirrors SeoSettings::defaults() — `stage` is the portal's primary browse
  // axis, so its archives are indexed; `status` is a workflow filter nothing
  // links to.
  indexArchives: { department: true, stage: true, status: false, tag: true, topic: true },
  indexProfiles: false
}

export const SEO_PLUGIN_LABELS: Record<string, string> = {
  aioseo: 'All in One SEO',
  rankmath: 'Rank Math',
  seopress: 'SEOPress',
  yoast: 'Yoast SEO'
}
