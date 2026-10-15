import { type Topic } from '@features/topic-modal/shared/type'
import { store } from '@wordpress/interactivity'

interface NavItem {
  /** Stage icon URL. Empty string when the stage has none — the REST default. */
  icon?: string
  label: string
  path: string
}

// Single WordPress Interactivity registration for the `bitConnectStore`
// namespace. Registering the same namespace more than once (previously also in
// ssr/topic.ts) clobbers state, so all SSR-hydrated fields live here under one
// merged shape. It exists so server-rendered markup (data-wp-each in the
// Sidebar) has state; React components fetch their own. The server's `data`
// topics are not used to seed the listing: they span every stage, while the
// listing opens on the default stage, so they would show the wrong topics until
// the fetch replaced them.
const { state: bitConnectStore } = store('bitConnectStore', {
  state: {
    data: [] as Topic[],
    navItems: [] as NavItem[]
  }
})

// Backwards-compatible export name used by the Sidebar's data-wp-each loop.
const navItemsStore = bitConnectStore

export { navItemsStore }
