export interface Product {
  description?: string
  id: number
  meta?: {
    /** Optional dark-mode override; falls back to `icon_url`. */
    bit_connect_icon_dark_id?: number
    bit_connect_icon_dark_url?: string
    bit_connect_icon_id?: number
    bit_connect_icon_url?: string
    /** Admin-defined position, written by dragging rows. Absent until first dragged. */
    bit_connect_order?: number
  }
  name: string
  slug: string
}

export interface ProductFormData {
  description?: string
  meta: {
    bit_connect_icon_dark_id?: number
    bit_connect_icon_dark_url?: string
    bit_connect_icon_id?: number
    bit_connect_icon_url?: string
  }
  name: string
  /** Left blank lets WordPress derive one from the name. */
  slug?: string
}

/** The flat shape the product form's fields hold. */
export interface ProductFormValues {
  description?: string
  icon_dark_id?: number
  icon_dark_url?: string
  icon_id?: number
  icon_url?: string
  name: string
  slug?: string
}
