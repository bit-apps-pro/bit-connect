export type PortalAccess = 'everyone' | 'logged_in'

export type LogoPermalinkMode = 'custom' | 'default'

/** Which of the portal topic-list filter controls are shown to visitors. */
export interface PortalFilters {
  product: boolean
  sort: boolean
  tags: boolean
}

/**
 * The promo card at the foot of the portal sidebar.
 *
 * `enabled` is off by default — the card is an outbound link on the site's own
 * public pages. Every line is the admin's own, with no default copy behind it:
 * an empty field is a row the card does not render, and a card with every field
 * empty does not render at all.
 */
export interface Promo {
  /** The link label on the bottom row. */
  cta: string
  enabled: boolean
  /** The top line, above the headline. */
  eyebrow: string
  headline: string
  phrases: string[]
  /** The static lead-in the phrases are typed after. */
  prefix: string
  url: string
}

export interface GeneralSettings {
  communityTitle: string
  logoLight: string
  logoPermalinkCustom: string
  logoPermalinkMode: LogoPermalinkMode
  portalAccess: PortalAccess
  portalFilters: PortalFilters
  promo: Promo
}

export type GeneralSettingsFormData = GeneralSettings
