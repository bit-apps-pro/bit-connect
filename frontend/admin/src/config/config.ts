if (typeof SERVER_VARIABLES === 'undefined') {
  // @ts-expect-error runtime-injected global variable
  globalThis.SERVER_VARIABLES =
    typeof window === 'undefined'
      ? {}
      : JSON.parse(
          globalThis?.document?.querySelector('#wp-script-module-data-bit-connect-index-MODULE')
            ?.textContent ?? '{}'
        )
}
type GetServerVariableType = <K extends keyof typeof SERVER_VARIABLES>(
  key: K,
  fallback?: (typeof SERVER_VARIABLES)[K]
) => (typeof SERVER_VARIABLES)[K]
const getServerVariable: GetServerVariableType = (key, fallback) => {
  if (!key && fallback) return fallback

  // Only a key the server never sent is worth flagging. A present-but-falsy
  // value (isLoggedIn: false, currentUser: null) is a legitimate guest/default
  // state, not a failure — warning on it buries real problems in the console.
  if (
    (!(key in SERVER_VARIABLES) || SERVER_VARIABLES?.[key] === undefined) &&
    import.meta.env.MODE !== 'test'
  ) {
    console.warn('🚥 Missing server variable:', key)
  }

  // Falsy values still fall back — callers rely on this substitution.
  if (!SERVER_VARIABLES?.[key] && fallback) return fallback

  return SERVER_VARIABLES[key]
}

interface ConfigType {
  AJAX_URL: string
  API_URL: string
  CAN_MANAGE: boolean
  CAN_MODERATE: boolean
  DATE_FORMAT: string
  FREE_VERSION: string
  IS_DEV: boolean
  IS_PRO: boolean
  IS_PRO_EXIST: boolean
  KEY?: string
  NONCE: string
  PLUGIN_ADMIN_URL: string
  PLUGIN_SLUG: string
  PRO_API_URL: string
  PRO_SLUG?: string
  PRO_VERSION?: string
  PRODUCT_NAME: string
  REDIRECT_URI: string
  ROOT_URL: string
  ROUTE_PREFIX: string
  SITE_BASE_URL: string
  SITE_URL: string
  TIME_FORMAT: string
  WP_REST_URL: string
}

// SSR/prerender safe: `window` is undefined in Node, and this object is built
// at module-eval time. Guard the origin so importing this module never throws.
const windowOrigin = typeof window === 'undefined' ? '' : window.location.origin

const config = {
  AJAX_URL: getServerVariable('ajaxURL', 'http://bit-pi.site/wp-admin/admin-ajax.php'),
  API_URL: getServerVariable('apiURL', `${windowOrigin}/wp-json/bit-connect/v1`),
  // Read straight off SERVER_VARIABLES rather than through getServerVariable:
  // that helper warns on any falsy value, and `false` here is a normal answer,
  // not a missing one.
  CAN_MANAGE: SERVER_VARIABLES?.canManage === true,
  CAN_MODERATE: SERVER_VARIABLES?.canModerate === true,
  DATE_FORMAT: getServerVariable('dateFormat', 'F j, Y'),
  FREE_VERSION: getServerVariable('version'),
  IS_DEV: import.meta.env.DEV,
  IS_PRO: SERVER_VARIABLES?.isPro === '1',
  IS_PRO_EXIST: getServerVariable('isProExist', '0') === '1',
  KEY: getServerVariable('key'), // license key
  NONCE: getServerVariable('nonce', ''),
  PLUGIN_ADMIN_URL: getServerVariable('pluginAdminURL', ''),
  PLUGIN_SLUG: getServerVariable('pluginSlug', 'bit-connect'),
  // Pro routes register under their own REST namespace, so they cannot be
  // addressed through API_URL. Sent by the pro plugin; the fallback only
  // matters before it has loaded, when nothing calls a pro route anyway.
  PRO_API_URL: getServerVariable('proApiURL', `${windowOrigin}/wp-json/bit-connect-pro/v1`),
  PRO_SLUG: getServerVariable('proSlug'),
  PRO_VERSION: getServerVariable('proPluginVersion'),
  PRODUCT_NAME: 'Bit Connect',
  REDIRECT_URI: getServerVariable('redirectUri', ''),
  ROOT_URL: getServerVariable('rootURL', 'http://.local'),
  ROUTE_PREFIX: getServerVariable('routePrefix', 'bit_pi_'),
  SITE_BASE_URL: getServerVariable('siteBaseURL', ''),
  SITE_URL: getServerVariable('siteURL', ''),
  TIME_FORMAT: getServerVariable('timeFormat', 'g:i a'),
  WP_REST_URL: getServerVariable('wpRestURL', `${windowOrigin}/wp-json/wp/v2`)
} as const satisfies ConfigType

export default config
