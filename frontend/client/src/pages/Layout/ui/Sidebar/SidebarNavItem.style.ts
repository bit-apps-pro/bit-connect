import { type GlobalToken } from 'antd'

interface NavItemStyle {
  isActive: boolean
  token: GlobalToken
}

export const navItemStyle = ({ isActive, token }: NavItemStyle) => {
  return {
    '&:focus': {
      color: isActive ? '#3266EA' : token.colorText
    },
    '&:focusVisible': {
      outline: `2px solid ${token.colorPrimary} !important`,
      outlineOffset: '2px'
    },
    '&:hover': {
      background: token.colorFillTertiary,
      color: isActive ? '#3266EA' : token.colorText
    },
    background: 'transparent',
    border: 'none',
    borderRadius: token.borderRadius,
    color: isActive ? '#3266EA' : token.colorText,
    fontWeight: isActive ? 500 : 400,
    padding: 10,
    textDecoration: 'none',
    width: '100%'
  }
}
