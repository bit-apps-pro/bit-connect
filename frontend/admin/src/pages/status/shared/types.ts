export interface Status {
  description?: string
  iconFileName?: string
  id: number
  meta?: {
    color?: string
    /** Optional dark-mode override; the portal falls back to `icon_url`. */
    icon_dark_id?: number
    icon_dark_url?: string
    icon_id?: number
    icon_url?: string
    /** Set on the status new topics are created with. Plugin-managed and read-only. */
    is_default?: boolean
    /** Admin-defined position, written by dragging rows. Absent until first dragged. */
    order?: number
  }
  name: string
  slug: string
}
