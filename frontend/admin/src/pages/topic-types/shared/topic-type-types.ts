export interface TopicType {
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
    /** Admin-defined position, written by dragging rows. Absent until first dragged. */
    order?: number
  }
  name: string
  slug: string
}
