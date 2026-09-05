import { LoadingOutlined } from '@ant-design/icons'
import { cn } from '@common/helpers/globalHelpers'
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
        className={cn([cls.layoutWrp, 'bc-p-5'])}
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
        <Content
          className="scroller thin bc-ml-5 bc-rounded-md bc-border bc-border-solid"
          style={{
            backgroundColor: antConfig.token.colorBgContainer,
            borderColor: antConfig.token.colorBorderSecondary,
            borderRadius: antConfig.token.borderRadius,
            overflow: 'auto'
          }}
        >
          <Suspense fallback={fallbackOf()} key={key}>
            <Outlet />
          </Suspense>
        </Content>
      </AntLayout>
    </ThemeProvider>
  )
}
