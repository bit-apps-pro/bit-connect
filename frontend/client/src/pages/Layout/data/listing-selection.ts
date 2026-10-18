/** What the listing is showing, as chosen in the sidebar — see use-listing-selection. */
export interface ListingSelection {
  /**
   * Router path of the archive the listing is narrowed to, which every stage
   * link keeps (`/team/platform`), or '' when it spans the forum.
   */
  scope: string
  /** Slug of the stage the reader named, or '' for none. */
  stage: string
}
