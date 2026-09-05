import { StyleProvider } from '@ant-design/cssinjs'
import NotifyContext from '@common/context/NotifyContext'
import { createAntDesignStyleContainer } from '@plugin-commons/utils/themeUtils'
import { useAppEssentials } from '@plugin-commons/utils/useAppEssentials'
import useApplyTheme from '@shared/theme/use-apply-theme'
import { ConfigProvider, message, notification, theme } from 'antd'
import { useAtom, useAtomValue } from 'jotai'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router'

import { $isDarkTheme } from './common/globalStates/$appConfig'
import $navigate from './common/globalStates/$navigate'
import BuyPro from './components/buy-pro'
import config from './config/config'
import { buttonTheme, darkThemeConfig, inputTheme, lightThemeConfig, selectTheme } from './config/theme'
import Error404 from './pages/Error404'
import Layout from './pages/Layout'
import useOnboardingStatus from './pages/onboarding/data/use-onboarding-status'

function OnboardingGuard() {
  const { isOnboardingCompleted, isOnboardingStatusPending } = useOnboardingStatus()

  if (!isOnboardingStatusPending && !isOnboardingCompleted) return <Navigate replace to="onboarding" />
  return isOnboardingStatusPending ? <></> : <Layout />
}

const Root = lazy(() => import('./pages/root/Root'))
const Stages = lazy(() => import('./pages/stages/stages'))
const Status = lazy(() => import('./pages/status/status'))
const TopicTypes = lazy(() => import('./pages/topic-types/topic-types'))
const Products = lazy(() => import('./pages/products/products'))
const Tags = lazy(() => import('./pages/tags/tags'))
const General = lazy(() => import('./pages/general/general'))
const Manager = lazy(() => import('./pages/manager'))
const Activity = lazy(() => import('./pages/activity'))
const Reports = lazy(() => import('./pages/reports'))
const Notifications = lazy(() => import('./pages/notifications'))
const Onboarding = lazy(() => import('./pages/onboarding/onboarding'))
const Settings = lazy(() => import('./pages/settings'))
const Seo = lazy(() => import('./pages/seo'))
const License = lazy(() => import('./pages/license/license'))

const { darkAlgorithm, defaultAlgorithm } = theme

const styleContainer = createAntDesignStyleContainer()

export default function AppRoutes() {
  const [navigateUrl, setNavigateUrl] = useAtom($navigate)
  const navigate = useNavigate()
  const isDarkTheme = useAtomValue($isDarkTheme)
  useApplyTheme(isDarkTheme)
  const themeTokens = isDarkTheme ? darkThemeConfig : lightThemeConfig
  const themeAlgorithm = isDarkTheme ? darkAlgorithm : defaultAlgorithm
  const [notificationApi, contextHolderNotification] = notification.useNotification({
    duration: 6,
    pauseOnHover: true,
    placement: 'bottomRight'
  })
  const [messageApi, contextHolderMessage] = message.useMessage({
    duration: 6
  })

  const notifyContextValue = useMemo(
    () => ({ messageApi, notificationApi }),
    [messageApi, notificationApi]
  )

  useAppEssentials()

  useEffect(() => {
    if (navigateUrl && navigateUrl !== '') {
      navigate(navigateUrl, { replace: true })
      setNavigateUrl('')
    }
  }, [navigate, navigateUrl, setNavigateUrl])

  return (
    <ConfigProvider
      theme={{
        algorithm: themeAlgorithm,
        components: {
          Button: buttonTheme(isDarkTheme),
          Input: inputTheme(isDarkTheme),
          Select: selectTheme(isDarkTheme),
          Table: {
            headerBorderRadius: 0
          },
          Tree: {
            indentSize: 12,
            paddingXS: 6
          }
        },
        token: themeTokens
      }}
    >
      <StyleProvider container={styleContainer} hashPriority="high" layer>
        {/* // TODO: separate the context providers into different component for performance */}
        <NotifyContext.Provider value={notifyContextValue}>
          {contextHolderNotification}
          {contextHolderMessage}
          <Routes>
            <Route
              element={
                <Suspense fallback={undefined}>
                  <Onboarding />
                </Suspense>
              }
              path="onboarding"
            />
            <Route element={<OnboardingGuard />} path="/">
              <Route element={config.CAN_MANAGE ? <Root /> : <Navigate replace to="activity" />} index />
              <Route element={<Stages />} path="stages" />
              <Route element={<General />} path="general" />
              <Route element={<Manager />} path="manager" />
              <Route element={<Activity />} path="activity" />
              <Route element={<Reports />} path="reports" />
              <Route element={<Notifications />} path="notifications" />
              <Route element={<Seo />} path="seo" />
              <Route element={<Settings />} path="settings" />
              {/* Registered in both builds. The free half sells the add-on; the
                  pro half activates it. It carries no menu entry — the plugin
                  row's Support link and the upsell modal are how people arrive. */}
              <Route element={<License />} path="license" />
              <Route element={<Tags />} path="tags" />
              <Route element={<Products />} path="products" />
              <Route element={<Status />} path="status" />
              <Route element={<TopicTypes />} path="topic-types" />
              <Route element={<Error404 />} path="*" />
            </Route>
          </Routes>

          {/* Mounted once, beside the routes rather than in them: every locked
              control in the app opens this same modal through
              $isBuyProModalOpen. In the pro build nothing sets that atom, so it
              renders a closed Modal.

              It has to sit *inside* ConfigProvider. Outside it — where this
              used to live, as a sibling of AppRoutes in main.tsx — antd fell
              back to its defaults, so the modal came up unthemed and, worse,
              on the default zIndexPopupBase of 1000. WordPress gives its admin
              bar 99999 and its menu 9990, so both painted over the mask and
              stayed clickable while the modal was open. */}
          <BuyPro />
        </NotifyContext.Provider>
      </StyleProvider>
    </ConfigProvider>
  )
}
