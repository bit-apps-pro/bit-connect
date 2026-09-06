import { describe, expect, it } from 'vitest'

import { toEditAttribution } from './edit-attribution'

const response = {
  at: '2026-08-04 10:12:00',
  by: 12,
  by_author: false,
  by_name: 'Rahim',
  by_slug: 'rahim'
}

describe('toEditAttribution', () => {
  it('camel-cases the payload a server sent', () => {
    expect(toEditAttribution(response)).toEqual({
      at: '2026-08-04 10:12:00',
      byAuthor: false,
      byName: 'Rahim',
      bySlug: 'rahim'
    })
  })

  it('reports nothing for content nobody has edited', () => {
    // eslint-disable-next-line unicorn/no-null -- the server sends JSON null here
    expect(toEditAttribution(null)).toBeUndefined()
    expect(toEditAttribution()).toBeUndefined()
  })

  it('treats a missing timestamp as never edited, whatever else came with it', () => {
    // A row carrying an editor but no time cannot say when, and a note reading
    // "Edited by Rahim" with no date behind it is worse than no note.
    expect(toEditAttribution({ ...response, at: '' })).toBeUndefined()
  })

  it('keeps the author flag, which picks between the two notes', () => {
    expect(toEditAttribution({ ...response, by_author: true })?.byAuthor).toBe(true)
  })

  it('carries an empty name through for an editor whose account is gone', () => {
    // The note falls back to a plain "(edited)" rather than naming nobody.
    const edited = toEditAttribution({ ...response, by_name: '', by_slug: '' })

    expect(edited?.byName).toBe('')
    expect(edited?.at).toBe('2026-08-04 10:12:00')
  })
})
