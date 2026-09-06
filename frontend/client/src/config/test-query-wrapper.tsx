import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'

/**
 * Test-only helper: builds a fresh QueryClient (retries disabled so failed
 * requests reject immediately) plus a wrapper for `renderHook`.
 *
 * The admin app has its own copy. Kept separate rather than shared because the
 * two apps mock different transports — the client's hooks go through
 * `@common/helpers/request`, the admin's through `@common/request`.
 *
 * Usage:
 *   const { queryClient, wrapper } = createQueryWrapper()
 *   const { result } = renderHook(() => useSomething(), { wrapper })
 */
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  })

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return { queryClient, wrapper }
}
