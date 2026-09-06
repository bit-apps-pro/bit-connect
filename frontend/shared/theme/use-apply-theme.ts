import { useEffect, useLayoutEffect } from 'react'

import { applyThemeToDocument } from './theme-mode'

// The portal is prerendered, so this module is evaluated in Node during the
// build, where useLayoutEffect warns and cannot run anyway.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Keeps `<html>` in sync with the resolved theme.
 *
 * Called once at the app root rather than from whatever component happens to
 * render first. Both apps used to do this from their Sidebar, which meant the
 * class was only correct on routes that render a sidebar — the portal's login,
 * register and verify-email screens sit outside the layout and never got it.
 *
 * Layout effect, not effect: this runs before the browser paints, so a theme
 * change cannot show one frame of the old one.
 */
export default function useApplyTheme(isDark: boolean): void {
  useIsomorphicLayoutEffect(() => {
    applyThemeToDocument(isDark)
  }, [isDark])
}
