import Devtools from '@plugin-commons/components/Devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@plugin-commons/resources/css/antd-reset.css'
import '@plugin-commons/resources/css/wp-css-reset.css'
import '@resource/styles/global.css'
import '@resource/styles/utilities.sass'
import '@resource/styles/variables.css'
import '@shared/theme/tokens.css'
// import '@resource/styles/global.css'
// import '@resource/styles/utilities.sass'
// import '@resource/styles/wp-css-reset.css'
// import 'antd/dist/reset.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'

import AppRoutes from './AppRoutes'

const queryClient = new QueryClient()
const elm = document.querySelector('#bit-apps-root')
if (elm) {
  const root = createRoot(elm)

  root.render(
    <StrictMode>
      <HashRouter>
        <QueryClientProvider client={queryClient}>
          <AppRoutes />
          <Devtools reactQuery />
        </QueryClientProvider>
      </HashRouter>
    </StrictMode>
  )
}
