import { StyleProvider } from '@ant-design/cssinjs'
import Topics from '@pages/topics'
import TopicArchive from '@pages/topics/archive'
import { useAppEssentials } from '@plugin-commons/utils/useAppEssentials'
import useApplyTheme from '@shared/theme/use-apply-theme'
import { externalLoginUrl } from '@utils/auth-urls'
import { createAntDesignStyleContainer } from '@utils/themeUtils'
import { ConfigProvider, notification, theme } from 'antd'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect, useMemo } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router'

import NotifyContext from './common/context/NotifyContext'
import { $isDarkTheme } from './common/globalStates/$appConfig'
import $navigate from './common/globalStates/$navigate'
import { useNotificationConfig, useResponsiveNotification } from './common/hooks/useNotificationConfig'
import config from './config/config'
import { buttonTheme, darkThemeConfig, inputTheme, lightThemeConfig, selectTheme } from './config/theme'
import { ForgotPassword, Login, Register as Signup, VerifyEmail } from './pages/Auth'
import Error404 from './pages/Error404'
import Layout from './pages/Layout'
import NotificationsPage from './pages/Notifications'
import PostDetailsPage from './pages/Post/PostDetailsPage'
import UserProfilePage from './pages/User'

// const Root = lazy(() => import('./pages/root/Root'))
// const Root = lazy(() => startTransition(import('./pages/root/Root')))

const { darkAlgorithm, defaultAlgorithm } = theme

const styleContainer = createAntDesignStyleContainer()
export const routeList: {
  element: React.ReactNode
  index: boolean
  path: string
}[] = [
  { element: <Topics />, index: false, path: '/' },
  // Deeper pages of the list. These are a crawl path rather than a UI — the
  // server marks them noindex, and the app uses infinite scroll — so this route
  // exists so anyone who does follow one lands on the list instead of a 404.
  { element: <Topics />, index: false, path: '/page/:pageNumber' },
  // Two segments, so this never competes with the single-segment `/:postName`
  // below even if a topic is ever given the slug "user".
  {
    element: <UserProfilePage />,
    index: false,
    path: '/user/:userSlug'
  },
  // A single static segment, which React Router ranks above the dynamic
  // `/:postName` below — so this still wins even if somebody publishes a topic
  // with the slug "notifications". Nothing here is public: the page renders a
  // sign-in prompt for a guest, and every query it makes is scoped to the
  // current session server-side.
  {
    element: <NotificationsPage />,
    index: false,
    path: '/notifications'
  },
  // Term archives (`/tag/api`, `/topic/question`). Also two segments, but React
  // Router ranks the static `/user` prefix above this dynamic one, so the
  // profile route above still wins. Unknown segments render 404 here, matching
  // the server, which only claims archive URLs whose term actually resolves.
  {
    element: <TopicArchive />,
    index: false,
    path: '/:archiveSegment/:termSlug'
  },
  {
    element: <PostDetailsPage />,
    index: false,
    path: '/:postName'
  },

  {
    element: <Error404 />,
    index: false,
    path: '*'
  }
]

function VerifyEmailRedirect() {
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const token = params.get('bc_token')
  const emailToken = params.get('bc_email_token')
  const uid = params.get('bc_uid')

  if (pathname === '/verify-email') return

  // An email *change* confirmation. Handled by the same page but a different
  // endpoint, so the token is forwarded under its own name rather than being
  // flattened into `token` — the page has to know which flow it is finishing.
  if (emailToken && uid) {
    return (
      <Navigate
        replace
        to={`/verify-email?email_token=${encodeURIComponent(emailToken)}&uid=${encodeURIComponent(uid)}`}
      />
    )
  }

  if (token) {
    const destination = uid
      ? `/verify-email?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`
      : `/verify-email?token=${encodeURIComponent(token)}`
    return <Navigate replace to={destination} />
  }
}

function PortalAccessGuard({ children }: { children: React.ReactNode }) {
  const { hash, pathname, search } = useLocation()
  if (config.PORTAL_ACCESS === 'logged_in' && !config.IS_LOGGED_IN) {
    const redirectPath = `${pathname}${search}${hash}`
    const loginUrl = externalLoginUrl(redirectPath)
    if (loginUrl) {
      // A server render has no `window` to navigate; emit nothing and let the
      // client perform the redirect once it mounts.
      if (typeof window === 'undefined') return
      window.location.href = loginUrl
      return
    }
    const redirect = encodeURIComponent(redirectPath)
    return <Navigate replace to={`/login?redirect_to=${redirect}`} />
  }
  return <>{children}</>
}

export default function AppRoutes() {
  const [navigateUrl, setNavigateUrl] = useAtom($navigate)
  const navigate = useNavigate()
  const isDarkTheme = useAtomValue($isDarkTheme)
  useApplyTheme(isDarkTheme)
  const themeTokens = isDarkTheme ? darkThemeConfig : lightThemeConfig
  const themeAlgorithm = isDarkTheme ? darkAlgorithm : defaultAlgorithm
  // Placement follows the viewport — see useNotificationConfig for the tunables.
  const [baseNotificationApi, contextHolderNotification] =
    notification.useNotification(useNotificationConfig())
  const notificationApi = useResponsiveNotification(baseNotificationApi)

  const notifyContextValue = useMemo(() => ({ notificationApi }), [notificationApi])

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
          Tree: {
            indentSize: 12,
            paddingXS: 6
          }
        },
        token: themeTokens
      }}
    >
      <StyleProvider container={styleContainer} hashPriority="high" layer>
        {/* AllPluginEssentials deliberately absent: license/update notices are
            wp-admin concerns whose server variables (ajaxURL, key, isProExist…)
            the portal never injects — rendering it here only dragged the admin
            app's config into the public bundle. It lives in the admin app. */}
        {/* // TODO: separate the context providers into different component for performance */}
        <NotifyContext.Provider value={notifyContextValue}>
          {contextHolderNotification}
          <VerifyEmailRedirect />
          <Routes>
            {/* Auth routes (outside layout) */}
            <Route element={<Login />} path="/login" />
            <Route element={<Signup />} path="/register" />
            <Route element={<VerifyEmail />} path="/verify-email" />
            <Route element={<ForgotPassword />} path="/forgot-password" />

            {/* Main routes (inside layout, guarded by portal access) */}
            <Route
              element={
                <PortalAccessGuard>
                  <Layout />
                </PortalAccessGuard>
              }
              path="/"
            >
              {routeList.map(route => (
                <Route element={route.element} index={route.index} key={route.path} path={route.path} />
              ))}
            </Route>
          </Routes>
        </NotifyContext.Provider>
      </StyleProvider>
    </ConfigProvider>
  )
}
