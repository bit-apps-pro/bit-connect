import { describe, expect, it } from 'vitest'

import bulkSummary from './bulk-summary'

const result = (done: number, skipped: number, failed: number) => ({
  counts: { done, failed, skipped },
  results: []
})

describe('bulkSummary', () => {
  it('tells apart topics changed and topics already so', () => {
    expect(bulkSummary(result(3, 1, 0))).toEqual({ text: '3 updated, 1 already so', type: 'success' })
  })

  it('is an error only when something could not be changed', () => {
    expect(bulkSummary(result(2, 0, 1))).toEqual({ text: '2 updated, 1 could not be changed', type: 'error' })
  })

  it('says so when nothing was there to change', () => {
    expect(bulkSummary(result(0, 0, 0))).toEqual({ text: 'Nothing changed.', type: 'success' })
  })
})
