import { chipColors, chipTagProps } from '@shared/color/chip-colors'
import { theme } from 'antd'
import { useCallback } from 'react'

/**
 * Chip colours for the theme the admin panel is currently rendering in.
 *
 * Shares its implementation with the portal so a colour previewed here is the
 * colour a reader sees on the site. The surface comes from the live
 * `colorBgContainer` token rather than from the `isDarkTheme` atom, so the
 * chips follow whatever Ant Design is actually painting behind them. See
 * `@shared/color/chip-colors` for how the pair is derived.
 */
export default function useChipProps() {
  const { token } = theme.useToken()
  const surface = token.colorBgContainer

  return {
    /** Colours only, for a chip that is not an Ant Design `Tag`. */
    chipColors: useCallback((hue?: string) => chipColors(hue, surface), [surface]),
    /** Props to spread onto an Ant Design `Tag`: `<Tag {...chipTagProps(hue)} />`. */
    chipTagProps: useCallback((hue?: string) => chipTagProps(hue, surface), [surface])
  }
}
