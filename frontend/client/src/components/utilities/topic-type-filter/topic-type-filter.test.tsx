import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TopicTypeFilter from './topic-type-filter'

const used = vi.hoisted(() => ({ value: undefined as string[] | undefined }))

vi.mock('./use-topic-types-used', () => ({ default: () => used.value }))
vi.mock('@/store/use-taxonomies-store', () => ({
  useTaxonomiesStoreSelect: () => ({
    'bit-connect-topic-types': [
      { name: 'Bug Report', slug: 'bug-report' },
      { name: 'Question', slug: 'question' },
      { name: 'Tutorial', slug: 'tutorial' }
    ]
  })
}))

const chips = (url = '/') => {
  render(
    <MemoryRouter initialEntries={[url]}>
      <TopicTypeFilter scope={{ tags: 'api' }} />
    </MemoryRouter>
  )
  return screen.queryAllByRole('button').map(button => button.textContent)
}

describe('TopicTypeFilter', () => {
  afterEach(() => {
    cleanup()
    used.value = undefined
  })

  it('offers every type until the archive has answered', () => {
    expect(chips()).toEqual(['All', 'Bug Report', 'Question', 'Tutorial'])
  })

  it('offers only the types the archive holds', () => {
    used.value = ['question']
    expect(chips()).toEqual(['All', 'Question'])
  })

  it('keeps the chip for the type in the URL, so it can be cleared', () => {
    used.value = ['question']
    expect(chips('/?topic-types=tutorial')).toEqual(['All', 'Question', 'Tutorial'])
  })

  it('draws no row for an archive with no topics', () => {
    used.value = []
    expect(chips()).toEqual([])
  })
})
