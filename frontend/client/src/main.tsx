import Devtools from '@plugin-commons/components/Devtools'
import { QueryClientProvider } from '@tanstack/react-query'
import '@plugin-commons/resources/css/antd-reset.css'
import '@plugin-commons/resources/css/wp-css-reset.css'
import '@resource/styles/global.css'
import '@resource/styles/utilities.sass'
import '@resource/styles/variables.css'
import '@shared/theme/tokens.css'
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import AppRoutes from './AppRoutes'
import config from './config/config'
import { queryClient } from './config/query-client'

// eslint-disable-next-line unicorn/prefer-query-selector
const elm = document.getElementById('bit-connect-u-root')
if (elm) {
  const app = (
    <StrictMode>
      <BrowserRouter basename={config.POST_URL || '/'}>
        <QueryClientProvider client={queryClient}>
          <AppRoutes />
          <Devtools reactQuery />
        </QueryClientProvider>
      </BrowserRouter>
    </StrictMode>
  )

  // `data-bc-no-hydrate` means the server painted plain semantic HTML (the
  // crawler-readable topic content, or the loading placeholder) rather than a
  // render of this component tree, so there is nothing to hydrate — mounting a
  // fresh root replaces it. Hydrating it would fail the structural match and make
  // React re-render the whole root anyway, just with errors logged first.
  if (elm.dataset.bcNoHydrate === '1') {
    elm.replaceChildren()
    createRoot(elm).render(app)
  } else {
    hydrateRoot(elm, app)
  }
}
