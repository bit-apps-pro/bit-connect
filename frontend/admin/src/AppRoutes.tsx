import { StyleProvider } from '@ant-design/cssinjs'
import NotifyContext from '@common/context/NotifyContext'
import { createAntDesignStyleContainer } from '@plugin-commons/utils/themeUtils'
import { useAppEssentials } from '@plugin-commons/utils/useAppEssentials'
import useApplyTheme from '@shared/theme/use-apply-theme'
import { ConfigProvider, message, notification, theme } from 'antd'
import { useAtom, useAtomValue } from 'jotai'
import { lazy, type ReactNode, Suspense, useEffect, useMemo } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'

import { $isDarkTheme } from './common/globalStates/$appConfig'
import $navigate from './common/globalStates/$navigate'
import config from './config/config'
import { buttonTheme, darkThemeConfig, inputTheme, lightThemeConfig, selectTheme } from './config/theme'
import Error404 from './pages/Error404'
import Layout from './pages/Layout'
import useOnboardingStatus from './pages/onboarding/data/use-onboarding-status'
import useAddedPages from './pages/use-added-pages'

function OnboardingGuard() {
  const { isOnboardingCompleted, isOnboardingStatusPending } = useOnboardingStatus()

  if (!isOnboardingStatusPending && !isOnboardingCompleted) return <Navigate replace to="onboarding" />
  return isOnboardingStatusPending ? <></> : <Layout />
}

/**
 * The General screen's old addresses, now tabs of Settings: Branding, Location
 * and Access became the Portal tab, and Sign in kept its own.
 */
function GeneralRedirect() {
  const { tab } = useParams()
  return <Navigate replace to={tab === 'auth' ? '/settings/sign-in' : '/settings'} />
}

/**
 * An address from before topics were called posts. A bookmark or a link in an
 * older email still lands on the screen, with its filters.
 */
function MovedTo({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate replace to={`${to}${search}`} />
}

/**
 * A screen only a forum manager may use. A moderator reaching one by its
 * address used to get the form drawn with wrong defaults and every save
 * refused; they land on Topics, as the dashboard already sends them.
 */
function manageOnly(screen: ReactNode) {
  return config.CAN_MANAGE ? screen : <Navigate replace to="/posts" />
}

const Root = lazy(() => import('./pages/root/root'))
const Stages = lazy(() => import('./pages/stages/stages'))
const Status = lazy(() => import('./pages/status/status'))
const TopicTypes = lazy(() => import('./pages/topic-types/topic-types'))
const Tags = lazy(() => import('./pages/tags/tags'))
const Manager = lazy(() => import('./pages/manager'))
const Topics = lazy(() => import('./pages/topics'))
const Activity = lazy(() => import('./pages/activity'))
const Reports = lazy(() => import('./pages/reports'))
const Onboarding = lazy(() => import('./pages/onboarding/onboarding'))
const Settings = lazy(() => import('./pages/settings'))
const Support = lazy(() => import('./pages/support/support'))

const { darkAlgorithm, defaultAlgorithm } = theme

const styleContainer = createAntDesignStyleContainer()

export default function AppRoutes() {
  const [navigateUrl, setNavigateUrl] = useAtom($navigate)
  const navigate = useNavigate()
  const isDarkTheme = useAtomValue($isDarkTheme)
  const addedPages = useAddedPages()
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
              <Route element={config.CAN_MANAGE ? <Root /> : <Navigate replace to="posts" />} index />
              <Route element={manageOnly(<Stages />)} path="stages" />
              {/* Folded into Settings; the old addresses still land there. */}
              <Route element={<GeneralRedirect />} path="general/:tab?" />
              <Route element={<Navigate replace to="/settings/notifications" />} path="notifications" />
              <Route element={<Navigate replace to="/settings/seo" />} path="seo" />
              <Route element={manageOnly(<Manager />)} path="manager" />
              <Route element={<Topics />} path="posts" />
              <Route element={<MovedTo to="/posts" />} path="topics" />
              <Route element={<Activity />} path="activity" />
              <Route element={<Reports />} path="reports" />
              <Route element={<MovedTo to="/settings/posts" />} path="settings/topics" />
              <Route element={manageOnly(<Settings />)} path="settings/:tab?" />
              {/* Support, the changelog and what the add-on adds. */}
              <Route element={manageOnly(<Support />)} path="support" />
              <Route element={manageOnly(<Tags />)} path="tags/:tab?" />
              <Route element={manageOnly(<Status />)} path="status" />
              <Route element={manageOnly(<TopicTypes />)} path="post-categories" />
              <Route element={<MovedTo to="/post-categories" />} path="topic-types" />
              {addedPages.map(page => (
                <Route element={page.element} key={page.path} path={page.path} />
              ))}
              <Route element={<Error404 />} path="*" />
            </Route>
          </Routes>
        </NotifyContext.Provider>
      </StyleProvider>
    </ConfigProvider>
  )
}
