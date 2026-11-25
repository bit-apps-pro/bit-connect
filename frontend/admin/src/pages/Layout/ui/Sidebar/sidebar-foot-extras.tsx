import { type ReactNode } from 'react'

interface SidebarFootExtrasProps {
  /** The sidebar is the narrow icon rail: show an icon, not a label. */
  compact: boolean
}

/**
 * Controls at the foot of the admin sidebar, above the theme switch.
 *
 * This plugin puts none there. A plugin that adds one replaces this module
 * and keeps its props, so the sidebar passes the same `compact` either way.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept so the call site stays typed
export default function SidebarFootExtras(_props: SidebarFootExtrasProps): ReactNode {
  // eslint-disable-next-line unicorn/no-null -- an empty slot renders nothing
  return null
}
