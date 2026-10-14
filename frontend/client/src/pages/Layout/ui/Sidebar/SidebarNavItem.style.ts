import { type GlobalToken } from 'antd'

interface NavItemStyle {
  isActive: boolean
  token: GlobalToken
}

/**
 * The row's colours. Hover and keyboard focus are classes on the row, not keys
 * here: this lands in an inline `style`, where `&:hover` is not CSS at all.
 * The weight is the row's `bc-font-medium` for the same reason — Tailwind
 * runs `important`, so a weight set here never applied.
 */
export const navItemStyle = ({ isActive, token }: NavItemStyle) => {
  return {
    background: 'transparent',
    border: 'none',
    borderRadius: token.borderRadius,
    // The theme's primary, not the light brand hex: dark mode lifts it, and
    // #3266EA read too dim as text on the dark sider.
    color: isActive ? token.colorPrimary : token.colorText,
    padding: 10,
    textDecoration: 'none',
    width: '100%'
  }
}
