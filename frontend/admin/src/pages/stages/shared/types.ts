export interface Stage {
  description?: string
  iconFileName?: string
  id: number
  meta?: {
    /** Optional dark-mode override; the portal falls back to `icon_url`. */
    bit_connect_icon_dark_id?: number
    bit_connect_icon_dark_url?: string
    bit_connect_icon_id?: number
    bit_connect_icon_url?: string
    /** Set on the stage new topics land in. Plugin-managed and read-only. */
    bit_connect_is_default?: boolean
    /** Admin-defined position, written by dragging rows. Absent until first dragged. */
    bit_connect_order?: number
  }
  name: string
  slug: string
}

export interface StageFormData {
  description?: string
  icon_dark_id?: number
  icon_dark_url?: string
  icon_file_name?: string
  icon_id?: number
  icon_url?: string
  name: string
  /** Left blank lets WordPress derive one from the name. */
  slug?: string
}
