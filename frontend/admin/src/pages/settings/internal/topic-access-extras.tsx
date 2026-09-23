import { type ComponentType } from 'react'

/**
 * Extra controls below the Topic Access switches, if a plugin adds any.
 *
 * A declaration, not a component: this plugin has no further topic-access
 * setting, so there is nothing here to render and this says so by being `null`
 * rather than by being a component that draws nothing. The settings screen
 * checks before it renders, so an empty slot costs no markup — not even the
 * margin that would sit above a control.
 *
 * The slot exists because a topic-access control belongs under that grid
 * rather than in it. A row in the grid writes to this plugin's settings blob
 * through this plugin's endpoint; anything below it keeps its own option and
 * its own endpoint, which is the whole difference.
 */
const TopicAccessExtras: ComponentType | null = null

export default TopicAccessExtras
