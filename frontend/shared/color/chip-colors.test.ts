import { describe, expect, it } from 'vitest'

import {
  chipColors,
  chipTagProps,
  contrastRatio,
  hslToRgb,
  mix,
  parseColor,
  relativeLuminance,
  type RGB,
  rgbToHsl,
  toHex
} from './chip-colors'

const LIGHT_SURFACE = '#ffffff'
const DARK_SURFACE = '#141414'

/** Every colour the plugin ships as a default, plus the awkward edges. */
const ADMIN_COLORS = [
  '#06b6d4', // Announcement
  '#ef4444', // Bug Report
  '#10b981', // Discussion
  '#8b5cf6', // Feature Request
  '#ec4899', // Feedback
  '#f59e0b', // How-To
  '#3b82f6', // Question
  '#18d61e', // Approved
  '#da4444', // Need Approval
  '#ecb53e', // Pending
  '#1677ff', // antd blue — the mid-tone that no text colour alone can fix
  '#ffff00', // maximally light
  '#000080', // maximally dark
  '#808080' // fully desaturated
]

describe('parseColor', () => {
  it('reads shorthand and full hex', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255])
    expect(parseColor('#10b981')).toEqual([16, 185, 129])
  })

  it('reads rgb() and rgba()', () => {
    expect(parseColor('rgb(16, 185, 129)')).toEqual([16, 185, 129])
    expect(parseColor('rgba(16 185 129 / 0.5)')).toEqual([16, 185, 129])
  })

  it('returns undefined for antd preset names and empty values', () => {
    expect(parseColor('green')).toBeUndefined()
    expect(parseColor('volcano')).toBeUndefined()
    expect(parseColor('')).toBeUndefined()
    expect(parseColor()).toBeUndefined()
  })
})

describe('hsl round trip', () => {
  it('returns the colour it was given', () => {
    for (const color of ADMIN_COLORS) {
      const rgb = parseColor(color) as RGB
      const [h, s, l] = rgbToHsl(rgb)
      expect(toHex(hslToRgb(h, s, l))).toBe(color)
    }
  })
})

describe('mix', () => {
  it('returns each end at the extremes', () => {
    const a: RGB = [255, 0, 0]
    const b: RGB = [0, 0, 255]
    expect(mix(a, b, 1)).toEqual(a)
    expect(mix(a, b, 0)).toEqual(b)
  })

  it('lands halfway at 0.5', () => {
    expect(mix([255, 255, 255], [0, 0, 0], 0.5)).toEqual([128, 128, 128])
  })
})

describe('contrastRatio', () => {
  it('is 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5)
    expect(contrastRatio([16, 185, 129], [16, 185, 129])).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    expect(contrastRatio([16, 185, 129], [255, 255, 255])).toBeCloseTo(
      contrastRatio([255, 255, 255], [16, 185, 129]),
      10
    )
  })
})

describe('chipColors', () => {
  it('clears AA for every admin colour on a light surface', () => {
    for (const color of ADMIN_COLORS) {
      const chip = chipColors(color, LIGHT_SURFACE)
      expect(chip, color).toBeDefined()
      const ratio = contrastRatio(
        parseColor(chip?.color) as RGB,
        parseColor(chip?.backgroundColor) as RGB
      )
      expect(ratio, `${color} label on its chip`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('clears AA for every admin colour on a dark surface', () => {
    for (const color of ADMIN_COLORS) {
      const chip = chipColors(color, DARK_SURFACE)
      expect(chip, color).toBeDefined()
      const ratio = contrastRatio(
        parseColor(chip?.color) as RGB,
        parseColor(chip?.backgroundColor) as RGB
      )
      expect(ratio, `${color} label on its chip`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the chip legible against the page, not just against itself', () => {
    // A chip that passed internally but sat invisibly on the page would be no
    // better; the background has to stay distinguishable from the surface.
    for (const surface of [LIGHT_SURFACE, DARK_SURFACE]) {
      for (const color of ADMIN_COLORS) {
        const chip = chipColors(color, surface)
        expect(chip?.backgroundColor, `${color} on ${surface}`).not.toBe(surface)
      }
    }
  })

  it('tints toward the surface rather than repainting the hue', () => {
    // The chip background is a pale version of the hue on white and a deep one
    // on near-black — the same hue, two surfaces.
    const light = chipColors('#10b981', LIGHT_SURFACE)
    const dark = chipColors('#10b981', DARK_SURFACE)

    const lightBg = relativeLuminance(parseColor(light?.backgroundColor) as RGB)
    const darkBg = relativeLuminance(parseColor(dark?.backgroundColor) as RGB)

    expect(lightBg).toBeGreaterThan(0.7)
    expect(darkBg).toBeLessThan(0.1)
  })

  it('preserves the admin hue in both the background and the label', () => {
    for (const color of ADMIN_COLORS) {
      const [hue, saturation] = rgbToHsl(parseColor(color) as RGB)
      if (saturation === 0) continue // grey has no hue to preserve

      for (const surface of [LIGHT_SURFACE, DARK_SURFACE]) {
        const chip = chipColors(color, surface)
        const [labelHue] = rgbToHsl(parseColor(chip?.color) as RGB)
        // Hue is on a 0–1 wheel, so compare the shorter way around.
        const drift = Math.min(Math.abs(labelHue - hue), 1 - Math.abs(labelHue - hue))
        expect(drift, `${color} label hue on ${surface}`).toBeLessThan(0.02)
      }
    }
  })

  it('inverts the label direction between the two surfaces', () => {
    // Dark ink on a light chip, bright ink on a dark one — for the same hue.
    const light = chipColors('#3b82f6', LIGHT_SURFACE)
    const dark = chipColors('#3b82f6', DARK_SURFACE)

    const lightLabel = relativeLuminance(parseColor(light?.color) as RGB)
    const darkLabel = relativeLuminance(parseColor(dark?.color) as RGB)

    expect(darkLabel).toBeGreaterThan(lightLabel)
  })

  it('falls back to high-contrast ink for a hue with no usable lightness', () => {
    const chip = chipColors('#808080', LIGHT_SURFACE)
    expect(chip?.color).toBe('#141414')
  })

  it('defaults to a white surface when none is given', () => {
    expect(chipColors('#10b981')).toEqual(chipColors('#10b981', LIGHT_SURFACE))
  })

  it('leaves antd preset names alone', () => {
    expect(chipColors('green', LIGHT_SURFACE)).toBeUndefined()
    expect(chipColors(undefined, LIGHT_SURFACE)).toBeUndefined()
  })
})

describe('chipTagProps', () => {
  it('drops antd colour handling when it produces its own', () => {
    const props = chipTagProps('#10b981', LIGHT_SURFACE)
    expect(props.color).toBeUndefined()
    expect(props.style).toEqual(chipColors('#10b981', LIGHT_SURFACE))
  })

  it('hands preset names back to antd untouched', () => {
    expect(chipTagProps('green', LIGHT_SURFACE)).toEqual({ color: 'green' })
    expect(chipTagProps(undefined, LIGHT_SURFACE)).toEqual({ color: undefined })
  })
})
