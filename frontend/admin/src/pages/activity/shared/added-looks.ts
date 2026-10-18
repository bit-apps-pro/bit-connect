import { type ActionLook } from './actions'

/**
 * How the log draws actions another plugin records — see
 * ExtensionPoints::activityActions().
 *
 * This plugin records only its own, and lookOf() already knows how each of
 * those looks, so there is nothing to add here. A slug that is in neither map
 * still gets a row, with the generic look.
 */
const addedLooks: Partial<Record<string, ActionLook>> = {}

export default addedLooks
