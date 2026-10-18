export interface Tag {
  /** Topics filed under it, as core's terms endpoint counts them. */
  count: number
  /** Who suggested it, when a member did; '' for an admin-created tag. */
  created_by?: string
  description?: string
  id: number
  name: string
  /** Suggested by a member and not yet approved — see TagApprovalService.php. */
  pending?: boolean
  slug: string
}
export interface TagFormData {
  description?: string
  name: string
  /** Left blank lets WordPress derive one from the name. */
  slug?: string
}
