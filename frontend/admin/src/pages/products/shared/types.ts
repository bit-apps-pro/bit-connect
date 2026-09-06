export interface Product {
  description?: string
  id: number
  meta?: {
    /** Admin-defined position, written by dragging rows. Absent until first dragged. */
    order?: number
  }
  name: string
  slug: string
}

export interface ProductFormData {
  description?: string
  name: string
  /** Left blank lets WordPress derive one from the name. */
  slug?: string
}
