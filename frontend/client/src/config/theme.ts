import { type AliasToken } from 'antd/es/theme/internal'

const fontFamily =
  "'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji'"

/** Single brand blue. Anything that needs it in plain CSS reads --bc-brand. */
const BRAND = '#3266ea'
const BRAND_HOVER = '#2450c4'
const BRAND_ACTIVE = '#1e43a8'

/* The same brand, lifted for dark surfaces. #3266ea reads 3.7:1 against
   #141414 — fine as a button fill under white text, too dim as link or hover
   text — so anywhere the brand is *ink* on a dark surface it steps up to
   these. Hovers lighten rather than darken: on a dark surface, "closer to the
   reader" is brighter. */
const BRAND_DARK = '#5985f0'
const BRAND_DARK_HOVER = '#7ba0f4'
const BRAND_DARK_ACTIVE = '#4a76e8'

/**
 * Button tokens — the one place that decides how an action looks in the portal.
 *
 * Sizes are a deliberate three-step scale rather than antd's defaults: the
 * portal is a public, touch-first surface, and a 32px control is below every
 * mainstream touch-target guideline. Nothing here is paired with an Input
 * inside a Space.Compact group, so raising the button height alone cannot
 * misalign a control row.
 *
 * Everything else exists to remove a reason for a component to hand-roll its
 * own button styling — the moment one screen writes its own hover colour, the
 * app has two design languages.
 */
export function buttonTheme(isDark: boolean) {
  return {
    // Comfortable, thumb-friendly targets. 44px on `large` matches the platform
    // guidance for primary actions.
    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 30,

    contentFontSize: 14,
    contentFontSizeLG: 15,
    contentFontSizeSM: 13,

    // Slightly softer than the 6px shared by inputs and cards. This used to be
    // forced from global.css with !important, which meant circle and round
    // buttons had to be excluded by hand; as a token antd applies it to the
    // base style only and those variants keep their own shape.
    borderRadius: 8,
    borderRadiusLG: 10,
    borderRadiusSM: 6,

    // antd's 400 makes a button read as a label. 500 reads as something to do,
    // without the shouty feel of 600.
    fontWeight: 500,

    paddingInline: 16,
    paddingInlineLG: 22,
    paddingInlineSM: 12,

    // antd 5 ships a soft drop shadow on solid buttons. It fights the flat
    // surfaces this UI uses everywhere else, so all three variants lose it.
    dangerShadow: 'none',
    defaultShadow: 'none',
    primaryShadow: 'none',

    // Secondary buttons warm towards the brand on hover instead of antd's
    // default blue-tinted border with unchanged text.
    defaultActiveBorderColor: isDark ? BRAND_DARK_ACTIVE : BRAND_ACTIVE,
    defaultActiveColor: isDark ? BRAND_DARK_ACTIVE : BRAND_ACTIVE,
    defaultHoverBg: isDark ? 'rgba(255, 255, 255, 6%)' : '#f4f7ff',
    defaultHoverBorderColor: isDark ? BRAND_DARK : BRAND,
    defaultHoverColor: isDark ? BRAND_DARK_HOVER : BRAND_HOVER,

    // Text and link buttons get a real surface on hover so they stop feeling
    // like plain text that happens to be clickable.
    linkHoverBg: isDark ? 'rgba(255, 255, 255, 6%)' : 'rgba(50, 102, 234, 8%)',
    textHoverBg: isDark ? 'rgba(255, 255, 255, 8%)' : 'rgba(2, 13, 39, 5%)'
  }
}

/**
 * Input and select tokens, theme-aware.
 *
 * These used to be spelled inline in each AppRoutes with literal light-theme
 * greys, which dark mode then inherited: a #d9d9d9 border glows on a #141414
 * control, and the pale blue selected-option tint swallowed the option text.
 */
export function inputTheme(isDark: boolean) {
  const restingBorder = isDark ? '#424242' : '#d9d9d9'
  return {
    activeBorderColor: restingBorder,
    activeShadow: 'none',
    errorActiveShadow: 'none',
    hoverBorderColor: restingBorder,
    warningActiveShadow: 'none'
  }
}

export function selectTheme(isDark: boolean) {
  const restingBorder = isDark ? '#424242' : '#d9d9d9'
  return {
    activeBorderColor: restingBorder,
    hoverBorderColor: restingBorder,
    optionSelectedBg: isDark ? 'rgba(50, 102, 234, 30%)' : '#eef1fe'
  }
}

export const lightThemeConfig: Partial<AliasToken> = {
  borderRadius: 6,
  borderRadiusSM: 4,
  borderRadiusXS: 2,
  boxShadow:
    '0 0 0 1px rgba(0,0,0,0.05), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
  boxShadowSecondary:
    '0 0 0 1px rgba(0,0,0,0.05), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
  // Status hues antd derives tints and borders from. The old colorSuccess
  // (#00ff87) was a neon that failed contrast as text everywhere it appeared;
  // these are ordinary saturated mid-tones that survive both as icon and ink.
  colorBgContainer: '#F9F9F9',
  colorError: '#dc2626',
  colorInfo: BRAND,
  colorPrimary: BRAND,
  colorPrimaryBg: '#eef1fe',
  colorPrimaryHover: BRAND_HOVER,
  colorSuccess: '#16a34a',
  colorTextBase: '#020d27',
  colorWarning: '#d97706',
  controlOutline: '#e8e8e8',
  fontFamily,
  motion: true,
  motionDurationSlow: '0.2s',
  zIndexPopupBase: 100_000
}

export const darkThemeConfig = {
  borderRadius: 10,
  borderRadiusSM: 8,
  borderRadiusXS: 4,
  // Lifted counterparts of the light status hues — see BRAND_DARK above for
  // why dark ink steps up in lightness rather than reusing the light values.
  colorError: '#ff8583',
  colorInfo: BRAND_DARK,
  colorPrimary: BRAND_DARK,
  colorPrimaryHover: BRAND_DARK_HOVER,
  colorSuccess: '#5dd48f',
  colorWarning: '#fbbf24',
  controlOutline: '#424242',
  fontFamily,
  motion: true,
  motionDurationSlow: '0.2s',
  zIndexPopupBase: 100_000

  // colorBgBase: '#1c1a1e',
  // colorBgBase: '#161218',
  // colorBgBase: '#040304',
  // colorTextBase: '#fce3ff',
  // colorTextBase: '#fef1ff',
  // colorPrimary: '#ff0374',
  // colorPrimary: '#ff246d',
  // colorSuccess: '#00ff7d',
  // colorWarning: '#ffc041'
  // colorBgElevated: 'rgb(28, 21, 28)',
  // colorBgContainer: '#151015',
  // colorBgContainer: '#221E20',
  // colorBgContainer: '#231E27',
  // colorBgContainer: '#2A242F',
  // boxShadow:
  //   '0 0 0 1px rgb(52, 40, 52), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05);',
  // boxShadowSecondary:
  //   '  0 0 0 1px rgb(52, 40, 52),    0 6px 16px 0 rgba(0, 0, 0, 0.08),      0 3px 6px -4px rgba(0, 0, 0, 0.12),      0 9px 28px 8px rgba(0, 0, 0, 0.05)    ',
  // controlOutline: '#ffaace33'
}
