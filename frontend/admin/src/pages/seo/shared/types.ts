/**
 * Key of a term archive — `stage`, `status`, `tag`, `topic`, or one a plugin
 * adds. Mirrors PortalTaxonomies::map().
 */
export type ArchiveSegment = string

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
  /** Each archive the portal serves: its name, its URL segment and how many terms it has. */
  archives: Record<string, { indexable: boolean; label?: string; slug?: string; terms: number }>
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
  indexArchives: { stage: true, status: false, tag: true, topic: true },
  indexProfiles: false
}
