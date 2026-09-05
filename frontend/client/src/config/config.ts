/* eslint-disable translate-obj-prop/translate-obj-prop */
import { type CapabilityMap } from '@/store/helper/capabilities'

if (typeof window === 'undefined') {
  // @ts-ignore
  global.SERVER_VARIABLES = {}
} else {
  // In built code every bare SERVER_VARIABLES read below is `define`d to
  // `window.bit_connect_` (vite.config.client.mts), the inline global
  // BaseView.php prints before this module runs. This assignment only seeds
  // contexts without that define (tests, the SSR prerender), where the global
  // is absent and an empty object keeps the fallbacks in charge.
  // @ts-ignore
  window.SERVER_VARIABLES = (window as { bit_connect_?: typeof SERVER_VARIABLES }).bit_connect_ ?? {}
}
type GetServerVariableType = <K extends keyof typeof SERVER_VARIABLES>(
  key: K,
  fallback?: (typeof SERVER_VARIABLES)[K]
) => (typeof SERVER_VARIABLES)[K]
const getServerVariable: GetServerVariableType = (key, fallback) => {
  if (!key && fallback) return fallback

  // Only a key the server never sent is worth flagging. A present-but-falsy
  // value (isLoggedIn: false, currentUser: null, logoPermalinkCustom: '') is a
  // legitimate guest/default state, not a failure — warning on it buried real
  // problems under a dozen bogus lines on every portal load.
  if (
    (!(key in SERVER_VARIABLES) || SERVER_VARIABLES?.[key] === undefined) &&
    import.meta.env.MODE !== 'test'
  ) {
    console.warn('🚥 Missing server variable:', key)
  }

  // Falsy values still fall back (callers rely on this — see the NONCE and
  // WP_LOGIN_URL comments below), the warning above just no longer fires.
  if (!SERVER_VARIABLES?.[key] && fallback) return fallback

  return SERVER_VARIABLES[key]
}

interface UserInfo {
  avatar: string
  /** Forum capabilities for this member — see `store/helper/capabilities.ts`. */
  capabilities?: CapabilityMap
  display_name: string
  email: string
  has_password?: boolean
  id: number
  pending_email?: string
  role?: null | string
  roles?: string[]
  slug?: string
  username: string
}

interface ConfigType {
  API_URL: string
  AUTH_MODE: 'custom_url' | 'plugin_default'
  CAN_REGISTER: boolean
  COMMUNITY_TITLE: string
  CURRENT_USER: null | UserInfo
  CURRENT_USER_AVATAR: string
  CUSTOM_LOGIN_URL: string
  CUSTOM_REGISTRATION_URL: string
  DATE_FORMAT: string
  DEFAULT_STAGE_SLUG: string
  DEFAULT_STATUS_SLUG: string
  FREE_VERSION: string
  IS_DEV: boolean
  IS_LOGGED_IN: boolean
  IS_PRO: boolean
  LOGIN_PAGE_CUSTOMIZATION: { banner: string; description: string; title: string }
  LOGO_LIGHT: string
  LOGO_PERMALINK_CUSTOM: string
  LOGO_PERMALINK_MODE: 'custom' | 'default'
  NONCE: string
  PLUGIN_SLUG: string
  PORTAL_ACCESS: 'everyone' | 'logged_in'
  PORTAL_FILTERS: { product: boolean; sort: boolean; tags: boolean }
  POST_URL: string
  PRODUCT_NAME: string
  /**
   * The sidebar promo card: the admin's opt-in and every word on it. An empty
   * string is a row the card does not render.
   */
  PROMO: {
    cta: string
    enabled: boolean
    eyebrow: string
    headline: string
    phrases: string[]
    prefix: string
    url: string
  }
  SITE_URL: string
  TIME_FORMAT: string
  /** Seed for the bell's badge, so it is right on first paint. */
  UNREAD_NOTIFICATIONS: number
  WP_LOGIN_URL: string
  /**
   * WordPress media limits, used to shrink pasted images before upload.
   * Missing only during the SSR prerender — the fallbacks mirror a stock
   * WordPress install (5 MB upload cap, 2560px big-image threshold).
   */
  WP_MEDIA_SETTINGS: { bigImageThresholdPx: number; maxUploadBytes: number }
  WP_REGISTER_URL: string
  WP_REST_URL: string
}

const siteURL = getServerVariable('siteURL', typeof window === 'undefined' ? '' : window.location.origin)

// Read as an object rather than three booleans: getServerVariable treats a
// falsy value as "missing" and hands back the fallback, so a filter switched
// off server-side would come back on. The object is always truthy, and only an
// explicit `false` inside it hides a control — a key missing during the SSR
// prerender (SERVER_VARIABLES is `{}` there) leaves the toolbar intact.
const portalFilters = getServerVariable('portalFilters', {}) ?? {}

// Same reason as portalFilters, plus one of its own: the promo card is off
// unless an admin asked for it, and reading `enabled` on its own would warn
// about a "missing" server variable on every load of every portal that did not.
const promo = getServerVariable('promo', {}) ?? {}

const config = {
  API_URL: getServerVariable(
    'apiURL',
    'http://backend.connect.btcd-test.io:8004/wp-json/bit-connect/v1'
  ),
  AUTH_MODE:
    (getServerVariable('authMode', 'plugin_default') as 'custom_url' | 'plugin_default') ??
    'plugin_default',
  CAN_REGISTER:
    getServerVariable('canRegister', false) === true || getServerVariable('canRegister', false) === '1',
  COMMUNITY_TITLE: getServerVariable('communityTitle', '') ?? '',
  CURRENT_USER: (getServerVariable('currentUser', null) as null | UserInfo) ?? null,
  CURRENT_USER_AVATAR: getServerVariable('currentUserAvatar', ''),
  CUSTOM_LOGIN_URL: getServerVariable('customLoginUrl', '') ?? '',
  CUSTOM_REGISTRATION_URL: getServerVariable('customRegistrationUrl', '') ?? '',
  DATE_FORMAT: getServerVariable('dateFormat', 'F j, Y'),
  // The stage the listing falls back to when the URL names none. Sent by the
  // server because an admin can rename it — 'questions' is only the slug a
  // fresh install happens to start with.
  DEFAULT_STAGE_SLUG: getServerVariable('defaultStageSlug', 'questions') || 'questions',
  DEFAULT_STATUS_SLUG: getServerVariable('defaultStatusSlug', 'need-approval') || 'need-approval',
  FREE_VERSION: getServerVariable('version'),
  IS_DEV: import.meta.env.DEV,
  IS_LOGGED_IN:
    getServerVariable('isLoggedIn', false) === true || getServerVariable('isLoggedIn', false) === '1',
  IS_PRO: SERVER_VARIABLES?.isPro === '1',
  LOGIN_PAGE_CUSTOMIZATION: getServerVariable('loginPageCustomization', {
    banner: '',
    description: '',
    title: ''
  }) ?? { banner: '', description: '', title: '' },
  LOGO_LIGHT: getServerVariable('logoLight', '') ?? '',
  LOGO_PERMALINK_CUSTOM: getServerVariable('logoPermalinkCustom', '') ?? '',
  LOGO_PERMALINK_MODE: (getServerVariable('logoPermalinkMode', 'default') ?? 'default') as
    | 'custom'
    | 'default',
  NONCE: getServerVariable('nonce', ''),
  // A real value, not '' — getServerVariable treats a falsy fallback as "no
  // fallback" and returns undefined, and this slug keys the persisted app
  // config (`${PLUGIN_SLUG}-config`), where `undefined-config` silently
  // orphans every stored preference. Matches PHP Config::SLUG.
  PLUGIN_SLUG: getServerVariable('pluginSlug', 'bit-connect'),
  PORTAL_ACCESS: (getServerVariable('portalAccess', 'everyone') ?? 'everyone') as
    | 'everyone'
    | 'logged_in',
  PORTAL_FILTERS: {
    product: portalFilters.product !== false,
    sort: portalFilters.sort !== false,
    tags: portalFilters.tags !== false
  },
  POST_URL: getServerVariable('postURL', ''),
  PRODUCT_NAME: 'Bit Connect',
  PROMO: {
    cta: promo.cta ?? '',
    enabled: promo.enabled === true,
    eyebrow: promo.eyebrow ?? '',
    headline: promo.headline ?? '',
    phrases: Array.isArray(promo.phrases) ? promo.phrases : [],
    prefix: promo.prefix ?? '',
    url: promo.url ?? ''
  },
  SITE_URL: siteURL,
  TIME_FORMAT: getServerVariable('timeFormat', 'g:i a'),
  // Read through Number() rather than as a fallback default: zero is the
  // commonest correct answer, and getServerVariable treats a falsy value as
  // "missing" — so a member with nothing unread would otherwise warn on every
  // page load and fall through to whatever default was passed.
  UNREAD_NOTIFICATIONS: Number(SERVER_VARIABLES?.unreadNotifications ?? 0) || 0,
  WP_LOGIN_URL: getServerVariable('wpLoginURL', `${siteURL}/wp-login.php`),
  WP_MEDIA_SETTINGS: getServerVariable('wpMediaSettings', {
    bigImageThresholdPx: 2560,
    maxUploadBytes: 5 * 1024 * 1024
  }) ?? { bigImageThresholdPx: 2560, maxUploadBytes: 5 * 1024 * 1024 },
  WP_REGISTER_URL: getServerVariable('wpRegisterURL', `${siteURL}/wp-login.php?action=register`),
  WP_REST_URL: getServerVariable('wpRestURL', 'http://backend.connect.btcd-test.io:8004/wp-json/wp/v2')
} as const satisfies ConfigType

export default config
