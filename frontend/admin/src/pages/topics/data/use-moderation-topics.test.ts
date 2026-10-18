import { describe, expect, it } from 'vitest'

import { asPage, toQueryParam } from './use-moderation-topics'

describe('toQueryParam', () => {
  it('leaves out filters that are not set', () => {
    expect(toQueryParam({ page: 1, per_page: 20, search: '', status: undefined, topic_type: 0 }, '')).toEqual({
      page: 1,
      per_page: 20
    })
  })

  it('sends added taxonomy terms flat, under their own parameter', () => {
    expect(toQueryParam({ page: 2, per_page: 20, terms: { boards: 7, other: undefined } }, '')).toEqual({
      boards: 7,
      page: 2,
      per_page: 20
    })
  })

  it('names the view only when one is open', () => {
    expect(toQueryParam({ page: 1, per_page: 20 }, 'some-list')).toMatchObject({ view: 'some-list' })
    expect(toQueryParam({ page: 1, per_page: 20 }, '')).not.toHaveProperty('view')
  })
})

describe('asPage', () => {
  it('turns a body of any other shape into an empty table', () => {
    expect(asPage()).toEqual({
      data: [],
      pagination: { current_page: 1, per_page: 20, total: 0, total_pages: 0 }
    })
  })

  it('keeps the rows and pagination the server sent', () => {
    const page = asPage({
      code: 'SUCCESS',
      data: { data: [], pagination: { current_page: 3, per_page: 50, total: 120, total_pages: 3 } },
      status: 'success'
    })

    expect(page.pagination).toEqual({ current_page: 3, per_page: 50, total: 120, total_pages: 3 })
  })
})
