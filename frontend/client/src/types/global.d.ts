declare module 'i18nwrap'
declare module 'incstr'
declare module 'postcss-csso'
declare module '*.module.css'
declare module '*.module.scss'
declare module '*.module.sass'
declare module '*.svg'
declare module '*.png'
declare module '*.json'

declare module 'bitapps-dev-utils'

declare let wp
declare function __(text: string, domain?: string): string
declare const VITE_PLUGIN_HAS_SUBMODULE_UPDATES: boolean

declare const SERVER_VARIABLES: {
  ajaxURL: string
  apiURL: string
  assetsURL: string
  authMode?: 'custom_url' | 'plugin_default'
  /**
   * Admin screens only — Head::createConfigVariable() sends these, the portal
   * bootstrap does not. Declared here because both apps share one ambient
   * SERVER_VARIABLES declaration and the admin build resolves to this one.
   */
  canManage?: boolean
  canModerate?: boolean
  canRegister?: '0' | '1' | boolean
  communityTitle?: string
  currentUser?: null | {
    avatar: string
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
  currentUserAvatar: string
  customLoginUrl?: string
  customRegistrationUrl?: string
  dateFormat: string
  defaultStageSlug?: string
  defaultStatusSlug?: string
  isLoggedIn?: '0' | '1' | boolean
  isPro: string
  isProExist?: string
  key?: string
  loggedInUserName: string
  loginPageCustomization?: {
    banner: string
    description: string
    title: string
  }
  logoLight?: string
  logoPermalinkCustom?: string
  logoPermalinkMode?: 'custom' | 'default'
  nonce: string
  pluginAdminURL: string
  pluginSlug: string
  portalAccess?: 'everyone' | 'logged_in'
  portalFilters?: { product?: boolean; sort?: boolean; tags?: boolean }
  postURL: string
  promo?: {
    cta?: string
    enabled?: boolean
    eyebrow?: string
    headline?: string
    phrases?: string[]
    prefix?: string
    url?: string
  }
  proApiURL: string
  proPluginVersion?: string
  proSlug?: string
  redirectUri: string
  restNonce: string
  rootURL: string
  routePrefix: string
  settings: string
  siteBaseURL: string
  siteURL: string
  timeFormat: string
  timeZone: string
  translations?: Record<string, string>
  /** Seed for the notification bell's badge. Absent during the SSR prerender. */
  unreadNotifications?: number
  uploadBaseUrl: string
  version: string
  wpLoginURL: string
  /** WordPress media limits (BaseView.php) — pasted images are shrunk to fit. */
  wpMediaSettings?: { bigImageThresholdPx: number; maxUploadBytes: number }
  wpRegisterURL: string
  wpRestURL: string
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type Builtin = Date | Error | Function | Primitive | RegExp

type CommonObjectValue =
  | boolean
  | CommonObjectValue[]
  | null
  | number
  | Record<string, CommonObjectValue>
  | string
  | undefined

type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends WeakMap<infer K, infer V>
        ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
        : T extends Set<infer U>
          ? ReadonlySet<DeepReadonly<U>>
          : T extends ReadonlySet<infer U>
            ? ReadonlySet<DeepReadonly<U>>
            : T extends WeakSet<infer U>
              ? WeakSet<DeepReadonly<U>>
              : T extends Promise<infer U>
                ? Promise<DeepReadonly<U>>
                : T extends object
                  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
                  : T

type KeyedValueHandler<T> = <K extends keyof T>(key: K, value: T[K]) => void

type NestedKeyOf<T> = {
  [K in keyof T]: T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` | `${K}` : `${K}`
}[keyof T]

type Primitive = bigint | boolean | null | number | string | symbol | undefined

type ValidationType<T> = Record<NestedKeyOf<T>, string[]>

type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}
