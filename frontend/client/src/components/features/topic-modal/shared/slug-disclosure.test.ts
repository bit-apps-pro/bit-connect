import { describe, expect, it } from 'vitest'

import { slugDisclosure } from './slug-disclosure'

describe('slugDisclosure', () => {
  it('says nothing when the server stored the slug that was asked for', () => {
    expect(slugDisclosure('my-topic', 'my-topic')).toBeUndefined()
  })

  it('says nothing when the author chose no slug at all', () => {
    // The server derived one from the title, which was never a promise to keep.
    expect(slugDisclosure('', 'derived-from-the-title')).toBeUndefined()
    expect(slugDisclosure(undefined, 'derived-from-the-title')).toBeUndefined()
  })

  it('names the slug the topic actually ended up at', () => {
    expect(slugDisclosure('getting-started', 'getting-started-2')).toBe(
      'The link you chose was already taken, so this topic is at /getting-started-2'
    )
  })

  // The field is only normalised on blur, so an unnormalised value can reach
  // the save — the server sanitizing it is not the same as it being taken.
  it('treats a slug the server merely tidied as the one that was asked for', () => {
    expect(slugDisclosure('My Topic', 'my-topic')).toBeUndefined()
  })

  // WordPress stores non-Latin slugs percent-encoded, so the two forms have to
  // be compared decoded or every such save would look like a clash.
  it('compares the encoded and readable forms of a slug as one', () => {
    expect(slugDisclosure('আমার-বিষয়', 'আমার-বিষয়')).toBeUndefined()
    expect(slugDisclosure('আমার-বিষয়', encodeURIComponent('আমার-বিষয়'))).toBeUndefined()
  })

  it('reports the readable form rather than the escaped octets', () => {
    expect(slugDisclosure('আমার', `${encodeURIComponent('আমার')}-2`)).toBe(
      'The link you chose was already taken, so this topic is at /আমার-2'
    )
  })
})
