import { type ComponentType } from 'react'

/**
 * Further chips before the stage's in the phone's listing context, if a plugin
 * adds any — one for each choice it adds beside the sidebar's stages.
 *
 * A declaration, not a component: the stage is the only choice this plugin's
 * listing offers, so there is nothing more to render and this says so by being
 * `null`. The row checks before it renders.
 */
// eslint-disable-next-line unicorn/no-null -- the slot is declared empty, and the caller tests for it
const ListingContextExtras: ComponentType | null = null

export default ListingContextExtras
