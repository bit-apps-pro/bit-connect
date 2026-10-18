import config from '@config/config'

/**
 * An in-app router path in the site's own permalink form — `/how-do-i/` on a
 * site whose permalinks end in a slash, `/how-do-i` on one whose do not.
 *
 * The app builds its own links, and WordPress answers the other form with a
 * 301. A link built bare therefore opened a URL the server does not serve as
 * such: the address bar disagreed with the canonical, and the first reload
 * redirected. Every portal link goes through here so the two always agree.
 *
 * React Router matches either form, so this changes the URL, never the route.
 * A query string or fragment is kept after the slash: `/login/?redirect=…`.
 */
export function routePath(path = '/'): string {
  const [, pathname = '', rest = ''] = /^([^?#]*)(.*)$/.exec(path) ?? []
  const withLead = pathname.startsWith('/') ? pathname : `/${pathname}`
  const bare = withLead.replace(/\/+$/, '')

  if (bare === '') return `/${rest}`

  return `${bare}${config.TRAILING_SLASH ? '/' : ''}${rest}`
}
