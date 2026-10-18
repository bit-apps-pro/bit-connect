export interface TopicType {
  description?: string
  id: number
  meta?: {
    bit_connect_color?: string
    /** Admin-defined position, written by dragging rows. Absent until first dragged. */
    bit_connect_order?: number
  }
  name: string
  slug: string
}
