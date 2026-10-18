import { type GlobalToken } from 'antd'

interface NavItemStyle {
  isActive: boolean
  token: GlobalToken
}

/**
 * The row's colours. Hover and focus are classes on the row: this lands in an
 * inline `style`, where `&:hover` is not CSS at all.
 */
export const navItemStyle = ({ isActive, token }: NavItemStyle) => ({
  background: 'transparent',
  border: 'none',
  borderRadius: token.borderRadius,
  // The theme's primary, which dark mode lifts, not the light brand hex.
  color: isActive ? token.colorPrimary : token.colorText,
  fontWeight: isActive ? 500 : 400,
  padding: '0 10px',
  width: '100%'
})
