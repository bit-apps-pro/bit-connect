import { wpApi } from '@utils/request/wp-api'
import sortByOrder from '@utils/sort-by-order'

interface StageTerm {
  id: number
  meta?: { bit_connect_order?: number }
}

let pending: Promise<StageTerm[]> | undefined

/**
 * Every stage, in the order an admin arranged them — asked for once per page.
 *
 * Two stores hold the stage list, the sidebar's and the topic header's, and the
 * header's effect ran again whenever the status list changed length. A topic
 * page asked the server for the same list three times, each a full WordPress
 * load. Stages change only on the admin's Stages screen, so the first answer
 * serves the whole page; a failed request is forgotten, so the next caller
 * tries again.
 */
export function fetchStagesApi<T extends StageTerm>(): Promise<T[]> {
  pending ??= wpApi<never, StageTerm[]>('bit-connect-stages', {
    method: 'GET',
    queryParam: { per_page: 100 }
  })
    .then(response => (Array.isArray(response.data) ? sortByOrder(response.data) : []))
    .catch((error: unknown) => {
      pending = undefined
      throw error
    })

  return pending as Promise<T[]>
}

/** Tests only: forget the shared answer, as a new page would. */
export const resetStagesForTests = () => {
  pending = undefined
}
