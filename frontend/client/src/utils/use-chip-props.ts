import { chipColors, chipTagProps } from '@shared/color/chip-colors'
import { theme } from 'antd'
import { useCallback } from 'react'

/**
 * Chip colours for the theme the portal is currently rendering in.
 *
 * The surface comes from the live `colorBgContainer` token rather than from the
 * `isDarkTheme` atom, so the chips follow whatever Ant Design is actually
 * painting behind them — including any future theme that is neither of today's
 * two. See `@shared/color/chip-colors` for how the pair is derived.
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
