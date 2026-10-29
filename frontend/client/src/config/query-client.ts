import { QueryClient } from '@tanstack/react-query'

/**
 * The browser app's single query cache.
 *
 * Exported rather than built inline in main.tsx so code outside the React tree
 * can reach it — the Zustand stores own voting, and a vote moves numbers that
 * are cached here rather than held in the store.
 *
 * The prerender entry deliberately does not use this one. It builds a client
 * per render so a build-time page can never inherit another page's data.
 *
 * A cached answer counts as fresh for 30 seconds. Without that, every screen
 * the reader goes back to asks the server again on mount, even a list they
 * left a moment ago. A write the reader makes still refreshes what it touches
 * at once, through the invalidations next to each mutation.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 }
  }
})
