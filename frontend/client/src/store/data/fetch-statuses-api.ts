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

let pending: Promise<Status[]> | undefined

/**
 * Every status, in the order an admin arranged them — asked for once per page.
 *
 * The topic header's effect ran again whenever the stage list changed length,
 * which sent this request twice on one topic page. Statuses change only on the
 * admin's Status screen, so the first answer serves the whole page; a failed
 * request is forgotten, so the next caller tries again.
 */
export function fetchStatusesApi(): Promise<Status[]> {
  pending ??= wpApi<never, Status[]>('bit-connect-statuses', {
    method: 'GET',
    queryParam: { per_page: 100 }
  })
    .then(response => (Array.isArray(response.data) ? sortByOrder(response.data) : []))
    .catch((error: unknown) => {
      pending = undefined
      throw error
    })

  return pending
}

/** Tests only: forget the shared answer, as a new page would. */
export const resetStatusesForTests = () => {
  pending = undefined
}
