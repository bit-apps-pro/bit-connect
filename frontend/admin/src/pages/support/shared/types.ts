/**
 * The contract between the version panel's two editions.
 *
 * Lives in `shared/` for the same reason every other split does: the `.pro`
 * implementation is compiled from a different tree, so the props it is handed
 * have to be described somewhere both trees can import without one reaching
 * into the other.
 */
export interface VersionPanelProps {
  /** The free plugin's slug, used to look the product up in `pluginInfoData`. */
  pluginSlug: string
}
