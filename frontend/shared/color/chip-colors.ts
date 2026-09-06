/**
 * Colour system for admin-picked chips (topic types, statuses, stages).
 *
 * The colour on a chip comes from term meta — an admin picks it in a colour
 * picker, so the frontend cannot assume a palette and cannot ship a hand-tuned
 * pair per colour. Two things then have to hold for every colour an admin can
 * pick, in both the light and the dark theme:
 *
 *   1. the label clears WCAG AA (4.5:1) against whatever is behind it, and
 *   2. the hue the admin picked is still recognisably the hue on screen.
 *
 * Painting the raw colour as a solid fill satisfies neither. Ant Design writes
 * white on a custom `color`, which drops a mid-green (`#10b981`) to ~2.4:1; and
 * the fix of nudging the fill until the text passes silently repaints the
 * admin's colour — `#10b981` ships as `#0d9a6c`, and every mid-tone chip glares
 * against a dark surface besides.
 *
 * So the chip is built *from* the surface instead. The background is the hue
 * mixed a little way into the surface, and the label is the same hue pushed in
 * lightness until it clears AA against that background. On white the result is
 * a pale tint with dark ink; on `#141414` the same hue becomes a deep tint with
 * bright ink. Neither the hue nor the contrast target changes — only the
 * surface does, which is exactly what a theme switch changes.
 *
 * `surface` is passed in rather than a `isDark` boolean so callers can hand it
 * the live Ant Design `colorBgContainer` token: the chip then tracks the theme
 * it is actually rendered in rather than a second, parallel notion of "dark".
 */

export type RGB = [number, number, number]

/** WCAG AA for normal-size text. */
const AA_CONTRAST = 4.5

/** How much of the hue is mixed into the surface to make the chip background. */
const TINT_ON_LIGHT = 0.12
const TINT_ON_DARK = 0.22

/** How much of the hue is mixed into the chip background to make its border. */
const BORDER_TINT = 0.35

/**
 * Lightness band the label starts from before contrast stepping. The chip keeps
 * some of the hue's own character, but a very pale hue cannot start pale on a
 * light surface (nor a very dark one start dark on a dark surface) or the
 * stepping below has to travel the whole scale and every chip lands on the same
 * extreme.
 */
const MAX_TEXT_L_ON_LIGHT = 0.42
const MIN_TEXT_L_ON_DARK = 0.55

/** Fallbacks for the rare hue where no lightness of it clears AA. */
const NEAR_BLACK: RGB = [20, 20, 20]
const NEAR_WHITE: RGB = [255, 255, 255]

const clampChannel = (n: number) => Math.min(255, Math.max(0, Math.round(n)))

/**
 * Parses a CSS colour into RGB channels (0–255).
 *
 * Only the forms a colour picker emits are handled — `#rgb`, `#rrggbb`, and
 * `rgb()`/`rgba()`. Ant Design's preset names ("green", "volcano") return
 * undefined on purpose: those already render as a light tint with dark text,
 * which is the shape this module produces anyway, so they are left alone.
 */
export function parseColor(color?: string): RGB | undefined {
  if (!color) return undefined

  const value = color.trim()

  const hexMatch = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value)
  if (hexMatch) {
    const hex = hexMatch[1]
    const full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16)
    ]
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(value)
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number)
    if (parts.length >= 3 && parts.slice(0, 3).every(n => Number.isFinite(n))) {
      return [clampChannel(parts[0]), clampChannel(parts[1]), clampChannel(parts[2])]
    }
  }

  return undefined
}

/** WCAG relative luminance of an sRGB colour. */
export function relativeLuminance([r, g, b]: RGB): number {
  const [lr, lg, lb] = [r, g, b].map(channel => {
    const c = channel / 255
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrastRatio(a: RGB, b: RGB): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)]
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Linear blend of two colours; `amount` is how much of `a` ends up in the result. */
export function mix(a: RGB, b: RGB, amount: number): RGB {
  return [0, 1, 2].map(i => clampChannel(a[i] * amount + b[i] * (1 - amount))) as RGB
}

export function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return [0, 0, l]

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6

  return [h, s, l]
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) {
    const v = clampChannel(l * 255)
    return [v, v, v]
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  const channel = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }

  return [
    clampChannel(channel(h + 1 / 3) * 255),
    clampChannel(channel(h) * 255),
    clampChannel(channel(h - 1 / 3) * 255)
  ]
}

export interface ChipColors {
  backgroundColor: string
  borderColor: string
  color: string
}

/**
 * Background, border and label for one chip.
 *
 * Returns undefined when the hue is not a colour we can reason about (an Ant
 * Design preset name, an empty value), so callers can hand the colour back to
 * Ant Design untouched rather than guess.
 *
 * @param hue     the colour the admin picked, as stored in term meta
 * @param surface what the chip sits on — pass the live `colorBgContainer` token
 */
export function chipColors(
  hue: string | undefined,
  surface: string | undefined = '#ffffff'
): ChipColors | undefined {
  const hueRgb = parseColor(hue)
  if (!hueRgb) return undefined

  const surfaceRgb = parseColor(surface) ?? NEAR_WHITE
  const surfaceIsDark = relativeLuminance(surfaceRgb) < 0.5

  const background = mix(hueRgb, surfaceRgb, surfaceIsDark ? TINT_ON_DARK : TINT_ON_LIGHT)

  return {
    backgroundColor: toHex(background),
    borderColor: toHex(mix(hueRgb, background, BORDER_TINT)),
    color: toHex(labelOn(background, hueRgb, surfaceIsDark))
  }
}

/**
 * The hue, moved in lightness only, until it clears AA against the chip
 * background. Hue and saturation are held so the label still reads as the
 * admin's colour rather than as generic dark or light ink.
 */
function labelOn(background: RGB, hue: RGB, surfaceIsDark: boolean): RGB {
  const [h, s, hueL] = rgbToHsl(hue)

  // A fully desaturated pick has no hue to preserve, and stepping a grey's
  // lightness lands on grey ink that reads as disabled — go straight to the
  // high-contrast fallback.
  if (s === 0) return fallbackLabel(background)

  const step = surfaceIsDark ? 0.02 : -0.02
  let l = surfaceIsDark ? Math.max(hueL, MIN_TEXT_L_ON_DARK) : Math.min(hueL, MAX_TEXT_L_ON_LIGHT)

  for (let i = 0; i < 50; i++) {
    const candidate = hslToRgb(h, s, l)
    if (contrastRatio(background, candidate) >= AA_CONTRAST) return candidate

    l += step
    if (l <= 0.03 || l >= 0.97) break
  }

  return fallbackLabel(background)
}

/** Whichever of near-black or near-white contrasts better — always clears AA. */
function fallbackLabel(background: RGB): RGB {
  return contrastRatio(background, NEAR_WHITE) >= contrastRatio(background, NEAR_BLACK)
    ? NEAR_WHITE
    : NEAR_BLACK
}

/**
 * Props for an Ant Design `Tag` rendering an admin-picked colour.
 *
 * `color` is deliberately dropped whenever we produce our own colours: Ant
 * Design's `ant-tag-has-color` also forces the close icon and link colours to
 * white, which an inline `color` alone would not undo. When the hue is one we
 * leave alone, `color` is passed through and `style` stays empty.
 */
export function chipTagProps(
  hue: string | undefined,
  surface?: string
): { color?: string; style?: ChipColors } {
  const colors = chipColors(hue, surface)
  return colors ? { style: colors } : { color: hue }
}
