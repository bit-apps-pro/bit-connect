import { type ReactElement } from 'react'
import { type IconType } from 'react-icons'

/** A screen a plugin adds to this admin — see use-added-pages. */
export interface AddedPage {
  /** Placed in the nav after the screen at this path, e.g. `topic-types`. */
  after: string
  element: ReactElement
  icon: IconType
  label: string
  /** Route path below the app root, e.g. `teams`. */
  path: string
  /** Which capability the screen answers to — see the Sidebar's own entries. */
  requires: 'manage' | 'moderate'
}
