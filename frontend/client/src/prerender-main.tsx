import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { type StaticHandlerContext } from 'react-router'
import { createStaticRouter, StaticRouterProvider } from 'react-router'
import '@plugin-commons/resources/css/antd-reset.css'
import '@plugin-commons/resources/css/wp-css-reset.css'
import '@resource/styles/global.css'
import '@resource/styles/utilities.sass'
import '@resource/styles/variables.css'

import { routeList } from './AppRoutes'

export function render(context: StaticHandlerContext) {
  const queryClient = new QueryClient()
  const router = createStaticRouter(routeList, context)
  const appHtml = renderToString(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <StaticRouterProvider context={context} router={router} />
      </QueryClientProvider>
    </StrictMode>
  )

  // Every query the render touches schedules a five-minute garbage collection
  // timer. React Query skips that when it believes it is on a server, but the
  // prerender script gives the app graph a happy-dom `window` so the browser
  // imports survive — and that same `window` is what the library reads to
  // decide. Dropping the cache clears the timers; left alone they hold Node's
  // event loop open, and the build sits there for five minutes after the last
  // page is written.
  queryClient.clear()

  return appHtml
}

export { routeList as routes } from './AppRoutes'
