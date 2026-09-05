import { describe, expect, it } from 'vitest'

import sortStages from './sort-by-order'

// WordPress cannot sort terms by meta, so the core terms endpoint hands them
// back alphabetically and the admin's arrangement is applied here instead. This
// mirrors TermOrderService::sort() on the backend; the two have to agree, or
// the portal and the admin screen show the same stages in different orders.
const stage = (id: number, order?: number) => ({ id, meta: order === undefined ? {} : { order } })

describe('sortStages', () => {
  it('puts the stages in the order the admin arranged', () => {
    expect(sortStages([stage(7, 2), stage(3, 0), stage(5, 1)]).map(s => s.id)).toEqual([3, 5, 7])
  })

  // A stage created after the last reorder has no position of its own. It goes
  // behind everything that does, rather than jumping to the front on a zero.
  it('sorts a stage that has never been dragged after the ones that have', () => {
    expect(sortStages([stage(9), stage(4, 1), stage(2, 0)]).map(s => s.id)).toEqual([2, 4, 9])
  })

  // Before any reorder that leaves the list in term-id order, which is what the
  // portal showed before ordering existed.
  it('falls back to oldest first when nothing has been arranged', () => {
    expect(sortStages([stage(12), stage(4), stage(8)]).map(s => s.id)).toEqual([4, 8, 12])
  })

  it('separates two stages sharing a position by their id', () => {
    expect(sortStages([stage(11, 3), stage(6, 3)]).map(s => s.id)).toEqual([6, 11])
  })

  it('treats position zero as a position rather than as the absence of one', () => {
    expect(sortStages([stage(30, 0), stage(10)]).map(s => s.id)).toEqual([30, 10])
  })

  it('handles a stage whose meta is missing entirely', () => {
    expect(sortStages([{ id: 9 }, { id: 4, meta: { order: 0 } }]).map(s => s.id)).toEqual([4, 9])
  })

  // The caller renders straight off the query cache, and mutating that array in
  // place is how a list re-sorts itself under the reader mid-render.
  it('leaves the array it was given alone', () => {
    const stages = [stage(7, 2), stage(3, 0)]

    sortStages(stages)

    expect(stages.map(s => s.id)).toEqual([7, 3])
  })

  it('copes with an empty list and a single stage', () => {
    expect(sortStages([])).toEqual([])
    expect(sortStages([stage(1, 5)]).map(s => s.id)).toEqual([1])
  })
})
