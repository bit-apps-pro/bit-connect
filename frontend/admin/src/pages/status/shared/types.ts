export interface Status {
  description?: string
  iconFileName?: string
  id: number
  meta?: {
    bit_connect_color?: string
    /** Optional dark-mode override; the portal falls back to `icon_url`. */
    bit_connect_icon_dark_id?: number
    bit_connect_icon_dark_url?: string
    bit_connect_icon_id?: number
    bit_connect_icon_url?: string
    /** Set on the status new topics are created with. Plugin-managed and read-only. */
    bit_connect_is_default?: boolean
    /** Admin-defined position, written by dragging rows. Absent until first dragged. */
    bit_connect_order?: number
  }
  name: string
  slug: string
}
