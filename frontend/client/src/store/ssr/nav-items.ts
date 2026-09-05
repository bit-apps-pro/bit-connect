import { type Topic } from '@features/topic-modal/shared/type'
import { getServerState, store } from '@wordpress/interactivity'

import { usePostsStore } from '../posts.zustand'

interface NavItem {
  /** Stage icon URL. Empty string when the stage has none — the REST default. */
  icon?: string
  label: string
  path: string
}

interface BitConnectServerState {
  data?: Topic[]
  navItems?: NavItem[]
}

// Single WordPress Interactivity registration for the `bitConnectStore`
// namespace. Registering the same namespace more than once (previously also in
// ssr/topic.ts) clobbers state, so all SSR-hydrated fields live here under one
// merged shape. Zustand remains the source of truth for React components; this
// store exists so server-rendered markup (data-wp-each in the Sidebar) has state
// and so the initial server payload can seed the client stores.
const { state: bitConnectStore } = store('bitConnectStore', {
  callbacks: {
    init() {
      const serverState = getServerState() as BitConnectServerState | undefined

      // Seed the posts store from the server-rendered topic list so the first
      // paint doesn't re-fetch. Best-effort: guard shape and never let a bad
      // payload break hydration.
      if (Array.isArray(serverState?.data) && serverState.data.length > 0) {
        try {
          usePostsStore.setState({ posts: serverState.data })
        } catch {
          // Ignore — the client will fetch fresh data on mount.
        }
      }
    }
  },
  state: {
    data: [] as Topic[],
    navItems: [] as NavItem[]
  }
})

// Backwards-compatible export name used by the Sidebar's data-wp-each loop.
const navItemsStore = bitConnectStore

export { navItemsStore }
