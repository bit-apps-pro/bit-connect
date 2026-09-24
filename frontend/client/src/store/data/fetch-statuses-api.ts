import { wpApi } from '@utils/request/wp-api'
import sortByOrder from '@utils/sort-by-order'

export interface Status {
  description?: string
  iconFileName?: string
  id: number
  meta?: {
    bit_connect_color?: string
    /** Optional dark-mode override; falls back to `icon_url`. */
    bit_connect_icon_dark_id?: number
    bit_connect_icon_dark_url?: string
    bit_connect_icon_id?: number
    bit_connect_icon_url?: string
    /** Set on the status new topics are created with. */
    bit_connect_is_default?: boolean
    /** Admin-defined position, set by dragging rows on the Status screen. */
    bit_connect_order?: number
  }
  name: string
  slug: string
}

/**
 * Fetch all statuses from bit-connect-statuses endpoint
 * @returns Promise<Status[]> - Array of fetched statuses
 */
export async function fetchStatusesApi(): Promise<Status[]> {
  const response = await wpApi<never, Status[]>('bit-connect-statuses', {
    method: 'GET',
    queryParam: { per_page: 100 }
  })

  return Array.isArray(response.data) ? sortByOrder(response.data) : []
}
