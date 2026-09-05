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
 */
export const queryClient = new QueryClient()
