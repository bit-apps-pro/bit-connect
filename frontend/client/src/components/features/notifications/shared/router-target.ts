import config from '@config/config'

/**
 * The router path a same-origin notification link points at, or undefined when
 * the link is outside the portal.
 *
 * The server writes absolute URLs — `/portal/how-do-i/#comment-4` — and the
 * router prepends its basename to whatever it is given, so handing it the
 * pathname as is opened `/portal/portal/how-do-i/`, a route that does not
 * exist. The basename comes off first.
 *
 * A path the portal does not own is not the router's to render: an older row
 * can carry the topic's post-type URL, which only the server knows how to
 * redirect. Undefined tells the caller to load it as a page instead.
 */
export default function routerTarget(url: URL): string | undefined {
  const base = (config.POST_URL || '/').replace(/\/+$/, '')
  const { hash, pathname, search } = url

  let path: string
  if (base === '') {
    path = pathname
  } else if (pathname === base || pathname.startsWith(`${base}/`)) {
    path = pathname.slice(base.length) || '/'
  } else {
    return undefined
  }

  return `${path}${search}${hash}`
}
