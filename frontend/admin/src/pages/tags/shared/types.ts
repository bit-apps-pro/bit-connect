export interface Tag {
  description?: string
  id: number
  name: string
  slug: string
}
export interface TagFormData {
  description?: string
  name: string
  /** Left blank lets WordPress derive one from the name. */
  slug?: string
}
