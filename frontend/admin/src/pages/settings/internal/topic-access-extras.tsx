import { type ReactNode } from 'react'

/**
 * Below the Topic Access switches: nothing.
 *
 * This plugin has no further topic-access setting, so the slot is empty. It
 * stays a component rather than being removed from the form, so the settings
 * screen keeps one place for a topic-access control to live.
 *
 * Returning `null` has to draw nothing at all, spacing included — see the note
 * in `settings-section.tsx`. Anything that fills this slot brings its own top
 * margin.
 */
export default function TopicAccessExtras(): ReactNode {
  // eslint-disable-next-line unicorn/no-null
  return null
}
