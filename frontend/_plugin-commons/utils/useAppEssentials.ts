import { useEffect, useLayoutEffect } from 'react'

import { setAppBgFromAdminBarBg, setCascadeLayerToWordpressStyles } from './themeUtils'

interface UseAppEssentialsProps {
  cssLayers?: string
}

export function useAppEssentials(props?: UseAppEssentialsProps) {
  const { cssLayers = '@layer wp, reset, antd, tailwind;' } = props || {}

  useLayoutEffect(() => {
    setCascadeLayerToWordpressStyles(cssLayers)
  }, [cssLayers])

  useEffect(() => {
    setTimeout(setAppBgFromAdminBarBg, 500)
  }, [])
}
