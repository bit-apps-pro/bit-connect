/**
 * Shared surface styles for the topic rail.
 *
 * One definition so the panels stay a single system: a hairline border instead
 * of a hard grey box, a slightly larger radius, and quiet uppercase labels that
 * let the content itself carry the visual weight.
 */

/** Card surface — hairline border, no heavy shadow. */
export const PANEL = 'bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4'

/** Section label: small, muted and spaced, so it reads as a caption not a heading. */
export const PANEL_TITLE =
  'bc-mb-3 bc-mt-0 bc-text-[11px] bc-font-semibold bc-uppercase bc-tracking-[0.06em] bc-text-ink-subtle'
