import { LoadingOutlined } from '@ant-design/icons'
import { Global, ThemeProvider } from '@emotion/react'
import { Layout as AntLayout, Space, theme } from 'antd'
import { useAtomValue } from 'jotai'
import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'

import { $isDarkTheme } from '../../../common/globalStates/$appConfig'
import { __ } from '../../../common/helpers/i18nWrap'
import OfflineBanner from '../../../components/utilities/OfflineBanner'
import globalCssInJs from '../../../resource/globalCssInJs'
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
  const antConfig = useToken()
  const { key } = useLocation()

  return (
    <ThemeProvider theme={antConfig}>
      <Global styles={globalCssInJs(antConfig, isDarkTheme)} />
      <OfflineBanner />
      <AntLayout
        className={cls.layoutWrp}
        color-scheme={isDarkTheme ? 'dark' : 'light'}
        hasSider
        style={{
          // One step below the panels in both themes; `transparent` in dark
          // let wp-admin's own light grey show through as gutters.
          backgroundColor: 'var(--bc-surface-sunken)',
          border: `1px solid ${antConfig.token.controlOutline}`,
          borderRadius: antConfig.token.borderRadius
        }}
      >
        <Sidebar />
        {/* The content shares the frame's sunken ground, so each screen's own
            cards are the only raised surfaces on it. The scrollbar's lane is
            kept even when nothing scrolls: otherwise a tab or panel that
            crosses the window height makes it appear, and the whole screen
            jumps sideways by its width. */}
        <Content className="scroller thin" style={{ overflow: 'auto', scrollbarGutter: 'stable' }}>
          <Suspense fallback={fallbackOf()} key={key}>
            <Outlet />
          </Suspense>
        </Content>
      </AntLayout>
    </ThemeProvider>
  )
}
