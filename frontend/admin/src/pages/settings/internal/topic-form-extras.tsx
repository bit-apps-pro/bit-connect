import { type ComponentType } from 'react'

/**
 * Further rows below the topic form's own, if a plugin adds any — a field it
 * files topics under, say, with the switch that offers it.
 *
 * A declaration, not a component: the topic type is the only optional field
 * this plugin's form has, so there is nothing more to render and this says so
 * by being `null`. The section checks before it renders.
 *
 * Below the grid rather than in it for the reason topic-access-extras gives: a
 * row here keeps its own option and its own endpoint, and saves on its own
 * rather than with this screen's Save button.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const TopicFormExtras: ComponentType | null = null

export default TopicFormExtras
