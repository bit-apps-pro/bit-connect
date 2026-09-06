import { $isDarkTheme } from '@common/globalStates/$appConfig'
import { __ } from '@common/helpers/i18nWrap'
import { pickThemedIcon, type ThemedIconMeta } from '@shared/theme/themed-icon'
import { Typography } from 'antd'
import { useAtomValue } from 'jotai'
import { useState } from 'react'

const { Text } = Typography

interface TermIconCellProps {
  /** Term name — the icon is what this cell is *about*, so it needs a real alt. */
  alt: string
  meta?: ThemedIconMeta
}

/**
 * The icon column shared by the stages, statuses and topic-types tables.
 *
 * Follows the admin's own theme rather than always showing the light artwork,
 * so an admin who uploads a dark-mode icon can confirm it looks right by
 * flipping the theme instead of having to open the portal.
 */
export default function TermIconCell({ alt, meta }: TermIconCellProps) {
  const isDarkTheme = useAtomValue($isDarkTheme)
  // Tracked as the URL, not a boolean, so switching theme retries the other
  // icon instead of inheriting this one's failure.
  const [brokenIcon, setBrokenIcon] = useState<string>()

  const icon = pickThemedIcon(meta, isDarkTheme)

  if (!icon || brokenIcon === icon) {
    return <Text type="secondary">{__('No icon')}</Text>
  }

  return (
    <img
      alt={alt}
      className="bc-h-8 bc-w-8 bc-rounded bc-object-contain"
      onError={() => setBrokenIcon(icon)}
      src={icon}
    />
  )
}
