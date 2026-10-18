import { describe, expect, it } from 'vitest'

import { deleteFilter, readFilter, urlParam } from './portal-query'

describe('portal query names', () => {
  it('names the topic and own-posts filters for posts, and leaves the rest', () => {
    expect(urlParam('topic-types')).toBe('topic')
    expect(urlParam('my_topics')).toBe('my_posts')
    expect(urlParam('tags')).toBe('tags')
  })

  it('reads a filter under its new name', () => {
    expect(readFilter(new URLSearchParams('topic=bug'), 'topic-types')).toBe('bug')
  })

  // A link shared before the rename keeps its filter.
  it('still reads a filter under its old name', () => {
    expect(readFilter(new URLSearchParams('topic-types=bug&my_topics=true'), 'topic-types')).toBe('bug')
    expect(readFilter(new URLSearchParams('my_topics=true'), 'my_topics')).toBe('true')
  })

  it('removes a filter under both names', () => {
    const params = new URLSearchParams('topic=bug&topic-types=idea&tags=api')

    deleteFilter(params, 'topic-types')

    expect(params.toString()).toBe('tags=api')
  })
})
