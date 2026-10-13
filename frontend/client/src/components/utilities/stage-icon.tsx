import { cn } from '@common/helpers/globalHelpers'
import { pickThemedIcon } from '@shared/theme/themed-icon'
import { useAtomValue } from 'jotai'
import { type ReactNode, useState } from 'react'

import { $isDarkTheme } from '@/common/globalStates/$appConfig'

interface StageIconProps {
  className?: string
  /** The dark-theme artwork; unset, the light icon serves both themes. */
  dark?: string
  /** Shown in the icon's place when the stage has none, or it fails to load. */
  fallback?: ReactNode
  /** The stage's base icon. */
  light?: string
}

/**
 * A stage's admin-uploaded icon, in the artwork for the portal's current theme.
 *
 * Decorative: it always sits beside the stage's name, so it carries an empty
 * alt rather than reading the name twice. Renders `fallback` (nothing, by
 * default) when the stage has no icon, or when the file fails to load — a
 * broken-image glyph beside the name says less than no icon at all.
 */
export default function StageIcon({ className, dark, fallback, light }: StageIconProps) {
  const isDarkTheme = useAtomValue($isDarkTheme)
  // Tracked as the URL, not a boolean, so switching theme retries the other
  // icon instead of inheriting this one's failure.
  const [brokenIcon, setBrokenIcon] = useState<string>()

  const icon = pickThemedIcon({ bit_connect_icon_dark_url: dark, bit_connect_icon_url: light }, isDarkTheme)

  if (!icon || brokenIcon === icon) return fallback

  return (
    <img
      alt=""
      className={cn(['bc-h-4 bc-w-4 bc-shrink-0 bc-object-contain', className])}
      onError={() => setBrokenIcon(icon)}
      src={icon}
    />
  )
}
