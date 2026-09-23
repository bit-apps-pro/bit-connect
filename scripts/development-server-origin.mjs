import process from 'node:process'

/**
 * The origin the browser fetches dev-server assets from.
 *
 * Vite prefixes every asset URL it emits in development — a CSS `url()`, an
 * imported image — with `server.origin`. Left unset, those URLs are
 * root-relative and the browser resolves them against the page it is on,
 * which here is WordPress rather than the dev server: a font referenced from
 * the bundled stylesheet 404s on the WordPress host. Module imports never had
 * the problem, because a module's URL is already on the dev host, which is
 * why nothing noticed until the first CSS `url()`.
 *
 * In Docker the frontend service names its browser-reachable host in
 * `BIT_CONNECT_FRONTEND_{ADMIN,CLIENT}_HOST` — a bare hostname that Traefik
 * routes on `TRAEFIK_HTTP_PORT`. Outside Docker the dev server is reached on
 * localhost at its own port.
 *
 * @param {string | undefined} host the routed hostname, if any
 * @param {number | string} port   the dev server's own port
 * @returns {string}
 */
export default function developmentServerOrigin(host, port) {
  const scheme = process.env.DEV_SSL === 'true' ? 'https' : 'http'

  if (host) {
    const proxyPort = process.env.TRAEFIK_HTTP_PORT
    return `${scheme}://${host}${proxyPort ? `:${proxyPort}` : ''}`
  }

  return `${scheme}://localhost:${port}`
}
