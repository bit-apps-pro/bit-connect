import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readRecentSearches, rememberSearch } from './recent-searches'
import SearchInput from './search-input'

// The debounce only paces requests; firing at once keeps the tests synchronous.
vi.mock('react-use', () => ({
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useDebounce: (callback: () => void, _ms: number, deps: unknown[]) => useEffect(callback, deps)
}))

vi.mock('./use-search-suggestions', () => ({
  default: (term: string) => {
    const enabled = term.trim().length >= 2

    return {
      enabled,
      isFetching: false,
      people: enabled ? [{ avatar: '', href: '', id: 7, name: 'Amara Diallo', slug: 'amara' }] : [],
      terms: enabled
        ? [{ archive: { filter: 'tags', follow: 'tag', label: 'Tag', taxonomy: 'bit-connect-tags' }, count: 3, name: 'api', slug: 'api' }]
        : [],
      topics: enabled
        ? [
            {
              comment_count: '2',
              comments_count: '2',
              ID: 1,
              post_name: 'rest-api-pagination',
              post_title: 'REST API pagination',
              terms: { topic_types: undefined },
              vote: { hasVoted: false, total: 4 }
            }
          ]
        : []
    }
  }
}))

function Where() {
  const { pathname, search } = useLocation()

  return <output data-testid="where">{`${pathname}${search}`}</output>
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <SearchInput />
      <Where />
    </MemoryRouter>
  )

const field = () => screen.getByRole('combobox')
const where = () => screen.getByTestId('where').textContent
const optionLabels = () => screen.queryAllByRole('option').map(option => option.textContent)

describe('SearchInput', () => {
  beforeEach(() => localStorage.clear())
  afterEach(cleanup)

  it('offers recent searches on focus with an empty field', () => {
    rememberSearch('webhooks')
    rememberSearch('billing')
    renderAt('/some-topic')

    fireEvent.focus(field())

    expect(screen.getByText('Recent searches')).toBeTruthy()
    expect(optionLabels()).toEqual(['billing', 'webhooks'])
  })

  it('suggests topics, terms and people, with the full search last', () => {
    renderAt('/some-topic')

    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: 'api' } })

    const labels = optionLabels()
    expect(labels[0]).toContain('REST API pagination')
    expect(labels[1]).toContain('Tag')
    expect(labels[2]).toContain('Amara Diallo')
    expect(labels.at(-1)).toBe('Search for “api”')
  })

  it('runs the full search on Enter with nothing highlighted, and remembers it', () => {
    renderAt('/some-topic')

    fireEvent.change(field(), { target: { value: 'api' } })
    fireEvent.keyDown(field(), { key: 'Enter' })

    expect(where()).toBe('/?search=api')
    expect(readRecentSearches()).toEqual(['api'])
  })

  it('opens the highlighted suggestion on Enter', () => {
    renderAt('/')

    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: 'api' } })
    fireEvent.keyDown(field(), { key: 'ArrowDown' })

    expect(field().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id)

    fireEvent.keyDown(field(), { key: 'Enter' })

    expect(where()).toBe('/rest-api-pagination')
  })

  it('keeps the list’s other filters when searching from it', () => {
    renderAt('/?sort=oldest&page=3')

    fireEvent.change(field(), { target: { value: 'api' } })
    fireEvent.keyDown(field(), { key: 'Enter' })

    expect(where()).toBe('/?sort=oldest&page=1&search=api')
  })

  it('shows the term being searched for on the results list', () => {
    renderAt('/?search=webhooks')

    expect((field() as HTMLInputElement).value).toBe('webhooks')
  })

  it('searches inside the archive it is on, as a chip', () => {
    renderAt('/tag/api')

    expect(field().getAttribute('placeholder')).toBe('Search in api')

    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: 'pagination' } })
    expect(optionLabels().slice(-2)).toEqual(['Search for “pagination” in api', 'Search for “pagination”'])

    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(where()).toBe('/tag/api?search=pagination')
  })

  it('offers searching everywhere from inside an archive', () => {
    renderAt('/tag/api')

    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: 'pagination' } })
    fireEvent.click(screen.getByText('Search for “pagination”'))

    expect(where()).toBe('/?search=pagination')
  })

  it('drops the scope on Backspace in an empty field', () => {
    renderAt('/tag/api')

    fireEvent.keyDown(field(), { key: 'Backspace' })
    expect(field().getAttribute('placeholder')).toBe('Search post, tag, etc.')

    fireEvent.change(field(), { target: { value: 'pagination' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(where()).toBe('/?search=pagination')
  })

  it('drops the scope from the chip’s remove button', () => {
    renderAt('/tag/api')

    fireEvent.click(screen.getByRole('button', { name: 'Search everywhere, not only in api' }))
    expect(field().getAttribute('placeholder')).toBe('Search post, tag, etc.')
  })

  it('shows the term searched for inside an archive', () => {
    renderAt('/tag/api?search=pagination')

    expect((field() as HTMLInputElement).value).toBe('pagination')
  })

  it('closes on Escape', () => {
    renderAt('/')

    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: 'api' } })
    expect(screen.queryByRole('listbox')).toBeTruthy()

    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
