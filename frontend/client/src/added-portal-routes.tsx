import { type ReactNode } from 'react'

/** A page a plugin draws at a portal path — see ExtensionPoints::portalPages(). */
export interface AddedPortalRoute {
  element: ReactNode
  /** One static segment, e.g. `/boards`; ranked above the topic catch-all. */
  path: string
}

/**
 * The portal pages plugins add. None here: the server serves the shell at a
 * plugin's path only when the plugin registers it, and the plugin supplies the
 * route that draws it.
 */
const addedPortalRoutes: AddedPortalRoute[] = []

export default addedPortalRoutes
