import { LoadingOutlined } from '@ant-design/icons'
import { cn } from '@common/helpers/globalHelpers'
import { Global, ThemeProvider } from '@emotion/react'
import LoginWarningModal from '@features/login-warning-modal/ui/login-warning-modal'
import useTaxonomies from '@features/topic-modal/data/use-taxonomies'
import getScrollParent from '@utils/get-scroll-parent'
import { Layout as AntLayout, Space, theme } from 'antd'
import { motion, useReducedMotion } from 'framer-motion'
import { useAtomValue } from 'jotai'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'

import { $isDarkTheme } from '../../../common/globalStates/$appConfig'
import { __ } from '../../../common/helpers/i18nWrap'
import OfflineBanner from '../../../components/utilities/OfflineBanner'
import globalCssInJs from '../../../resource/globalCssInJs'
import Header from './header/header'
import cls from './Layout.module.css'
import Sidebar from './Sidebar'

const { useToken } = theme
const { Content } = AntLayout

const fallbackOf = () => {
  return (
    <Space className="bc-p-6">
      {__('Loading')}
      <LoadingOutlined />
    </Space>
  )
}

export default function Layout() {
  const isDarkTheme = useAtomValue($isDarkTheme)
  useTaxonomies()
  const antConfig = useToken()

  const { key: locationKey, pathname } = useLocation()
  const suspenseKey = pathname.split('/')[1]
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // A tap in the phone drawer is a choice made, so it closes on arrival —
  // leaving it open hid the list the reader just picked. Keyed on the location
  // entry rather than the path: picking a stage inside a scoped archive changes
  // only `?stage=`.
  useEffect(() => {
    setSidebarOpen(false)
  }, [locationKey])

  const shouldReduceMotion = useReducedMotion()

  // Whether anything has scrolled under the header, which is the only moment
  // its rule has something to separate — see the bar itself in header.tsx.
  //
  // A 1px sentinel at the top of the scroller, watched by an observer rather
  // than a scroll listener: this fires twice per page instead of on every frame
  // of every scroll, and it needs no scroll-position arithmetic. It sits
  // outside the keyed motion.div below so a route change doesn't swap the node
  // the observer holds.
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const node = topSentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(([entry]) => setIsScrolled(!entry.isIntersecting), {
      root: getScrollParent(node)
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <ThemeProvider theme={antConfig}>
      <Global styles={globalCssInJs(antConfig, isDarkTheme)} />
      <OfflineBanner />
      <LoginWarningModal />
      <Header isScrolled={isScrolled} onMenuOpen={() => setSidebarOpen(true)} />
      <AntLayout
        className={cls.layoutWrp}
        color-scheme={isDarkTheme ? 'dark' : 'light'}
        hasSider
        style={{
          // One flat surface: the sider and the list are separated by a rule,
          // not floated as two cards over a sunken backdrop. Explicit rather
          // than `transparent`, which let the page body — which this app does
          // not own — show through in dark mode.
          backgroundColor: 'var(--bc-surface)',
          // The root is a 100dvh flex column (see global.css); growing into the
          // space left after the header replaces the old hard-coded 90vh, which
          // under-shot on tall screens and over-shot on short ones.
          flex: '1 1 auto',
          minHeight: 0
        }}
      >
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <Content className={cn([cls.contentWrp, 'scroller thin bc-bg-surface'])}
          style={{ overflow: 'auto' }}
        >
          {/* Scroll sentinel for the header rule above. The negative margin
              gives back the 1px it occupies, so watching the scroll position
              costs the page below it no space. */}
          <div aria-hidden="true" className="bc-h-px bc--mb-px" ref={topSentinelRef} />

          {/* Enter-only fade keyed by pathname: each navigation fades the new
              page in. Deliberately no AnimatePresence exit here — animating the
              outgoing page requires snapshotting the outlet and doubles the
              transition time; an enter fade gives the perceived smoothness
              without either cost. */}
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            key={pathname}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Suspense fallback={fallbackOf()} key={suspenseKey}>
              <Outlet />
            </Suspense>
          </motion.div>
        </Content>
      </AntLayout>
    </ThemeProvider>
  )
}
