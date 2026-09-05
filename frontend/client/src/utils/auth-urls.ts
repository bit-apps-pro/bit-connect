import config from '@config/config'

/**
 * Auth URL resolution for both authentication modes.
 *
 * The portal is a SPA mounted on a WordPress page, so every URL that leaves the
 * SPA has to be rebuilt from three parts: the site origin, the portal page path
 * (the router basename) and the in-app path. React Router's `location.pathname`
 * never contains the basename, so concatenating it onto the site URL silently
 * drops `/portal` and sends the visitor to a page that does not exist.
 *
 * Custom-URL mode also has to survive whatever an administrator typed into the
 * settings field: a blank value, a relative path, or a scheme-less host — plus
 * the blank the server substitutes for a URL pointing back at the portal's own
 * login route. None of those may leave the visitor without a way to sign in, so
 * every resolver falls back to the WordPress login/registration URL — which is
 * itself filtered by WordPress and therefore already points at whatever login
 * page the site actually uses.
 */

/** Trailing slashes are meaningless for joining and produce `//` when kept. */
function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * Root-relative URL for an in-app router path, including the portal page
 * basename — `/community/user/aiden-carter`.
 *
 * The host is left off on purpose wherever the result ends up inside posted
 * content: both sanitizers a comment passes through read an `http…` href as
 * somebody else's site, one adding `rel="nofollow ugc"` and the other
 * `target="_blank"`. This is the same form the server writes a mention's href
 * in (MentionController), and it survives the site later moving domain.
 */
export function portalPath(path = '/'): string {
  const base = trimTrailingSlash(config.POST_URL)
  if (!path || path === '/') return `${base}/`
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** Absolute URL for an in-app router path, including the portal page basename. */
export function portalUrl(path = '/'): string {
  return `${trimTrailingSlash(config.SITE_URL)}${portalPath(path)}`
}

/**
 * Turn a configured value into an absolute URL.
 *
 * Accepts what administrators actually type: `https://site.com/login`,
 * `/login`, or `site.com/login`. Returns undefined when nothing usable is left.
 */
function toAbsoluteUrl(value: string): undefined | URL {
  const trimmed = value.trim()
  if (!trimmed) return undefined

  const base = config.SITE_URL || (typeof window === 'undefined' ? undefined : window.location.origin)

  try {
    // "accounts.example.com/login" is a host, not a path on this site, but URL
    // resolves it against the base as a path. Give it the site's own scheme —
    // the same promotion esc_url_raw() performs when the value is stored.
    const candidate = isSchemeLessHost(trimmed)
      ? `${base ? new URL(base).protocol : 'https:'}//${trimmed}`
      : trimmed

    return new URL(candidate, base)
  } catch {
    // Not parseable even against the site origin — e.g. "http://" on its own.
    return undefined
  }
}

/** "example.com/login" — a bare host, as opposed to "/login" or "https://…". */
function isSchemeLessHost(value: string): boolean {
  if (/^[a-z][\d+.a-z-]*:/i.test(value)) return false
  if (value.startsWith('/') || value.startsWith('#') || value.startsWith('?')) return false

  const host = value.split(/[#/?]/)[0]

  return host.includes('.') && !host.includes(' ')
}

/**
 * Pick the first configured URL that is usable, or undefined when none is.
 *
 * Self-referencing values — a custom login page pointing at a route the SPA
 * renders itself, which would bounce the visitor between the portal and itself
 * forever — arrive here already blanked by the server (AuthService), because
 * only WordPress can tell them apart from a legitimate destination. Where the
 * portal is the front page its basename is empty, so every `/login` on the site
 * reads as the portal's own; whether it actually is depends on whether real
 * content answers that URL, which the client cannot see.
 */
function firstConfiguredUrl(candidates: string[]): undefined | URL {
  for (const candidate of candidates) {
    const url = toAbsoluteUrl(candidate)
    if (url) return url
  }

  return undefined
}

/** Same, but always yields somewhere reachable by falling back to WordPress. */
function firstUsableUrl(candidates: string[], fallback: string): URL {
  return (
    firstConfiguredUrl(candidates) ??
    toAbsoluteUrl(fallback) ??
    new URL(`${trimTrailingSlash(config.SITE_URL)}/wp-login.php`)
  )
}

function withRedirect(url: URL, redirectPath: string): string {
  const target = redirectPath.startsWith('http') ? redirectPath : portalUrl(redirectPath)
  url.searchParams.set('redirect_to', target)

  return url.toString()
}

/**
 * External login URL for the current mode, or undefined when the portal should
 * render its own login form.
 *
 * @param redirectPath in-app path (or absolute URL) to return to after login
 */
export function externalLoginUrl(redirectPath = '/'): string | undefined {
  if (config.AUTH_MODE !== 'custom_url') return undefined

  return withRedirect(firstUsableUrl([config.CUSTOM_LOGIN_URL], config.WP_LOGIN_URL), redirectPath)
}

/**
 * External registration URL for the current mode, or undefined when the portal
 * should render its own registration form.
 *
 * Falls back to the custom login page when only that one is configured — a
 * combined login/registration page is the common case for the plugins this mode
 * exists to support.
 */
export function externalRegisterUrl(redirectPath = '/'): string | undefined {
  if (config.AUTH_MODE !== 'custom_url') return undefined

  return withRedirect(
    firstUsableUrl([config.CUSTOM_REGISTRATION_URL, config.CUSTOM_LOGIN_URL], config.WP_REGISTER_URL),
    redirectPath
  )
}

/**
 * Whether a "Register" entry point should be shown to a logged-out visitor.
 *
 * Plugin-default mode asks WordPress: `users_can_register` decides, because the
 * portal's own form is what would create the account.
 *
 * Custom-URL mode hands that decision to whichever page the administrator
 * configured. Membership plugins routinely register accounts themselves with
 * `users_can_register` left off, so the option must not veto a link to a page
 * that does work. But with nothing configured, externalRegisterUrl() falls back
 * to wp-login.php?action=register, which shows only WordPress' "registration is
 * not allowed" notice while the option is off — there is nothing behind the
 * button then, so it stays hidden.
 */
export function registrationIsOffered(): boolean {
  if (config.AUTH_MODE !== 'custom_url') return config.CAN_REGISTER

  return (
    firstConfiguredUrl([config.CUSTOM_REGISTRATION_URL, config.CUSTOM_LOGIN_URL]) !== undefined ||
    config.CAN_REGISTER
  )
}
