import { describe, expect, it } from 'vitest'

import { findMentionQuery } from './quill-mention'

/**
 * The rule the whole picker turns on: when an "@" is somebody starting to name
 * a colleague, and when it is just a character in a sentence.
 *
 * Worth stating here rather than through a live editor because both halves are
 * failures a user feels — a picker that will not open over the name they are
 * typing, and one that opens in the middle of every email address.
 */
describe('findMentionQuery', () => {
  it('opens on an "@" at the start of the text', () => {
    expect(findMentionQuery('@aid')).toEqual({ index: 0, length: 4, term: 'aid' })
  })

  it('opens on an "@" after a space', () => {
    expect(findMentionQuery('thanks @priya')).toEqual({ index: 7, length: 6, term: 'priya' })
  })

  it('opens on the "@" alone, before anything is typed', () => {
    expect(findMentionQuery('thanks @')).toEqual({ index: 7, length: 1, term: '' })
  })

  it('reports where to replace from, so the "@" goes with the name', () => {
    const text = 'ping @car'
    const query = findMentionQuery(text)

    // index..index+length is exactly "@car" — what the picked name replaces.
    expect(text.slice(query!.index, query!.index + query!.length)).toBe('@car')
  })

  it('does not open inside an email address', () => {
    expect(findMentionQuery('mail releases@example')).toBeUndefined()
  })

  it('does not open on an "@" that is no longer at the caret', () => {
    // The author has moved on: a name was typed and then a space.
    expect(findMentionQuery('@aiden ')).toBeUndefined()
  })

  it('closes once the term runs into punctuation', () => {
    expect(findMentionQuery('@aiden,')).toBeUndefined()
  })

  it('opens after an opening bracket, where a name is a reasonable thing to type', () => {
    expect(findMentionQuery('(@aiden')).toEqual({ index: 1, length: 6, term: 'aiden' })
  })

  it('gives up on a run long enough to be prose rather than a name', () => {
    expect(findMentionQuery(`@${'a'.repeat(60)}`)).toBeUndefined()
  })

  it('accepts the characters a slug is made of', () => {
    expect(findMentionQuery('@aiden-carter.2_x')?.term).toBe('aiden-carter.2_x')
  })

  it('finds nothing in text with no "@" at all', () => {
    expect(findMentionQuery('just a comment')).toBeUndefined()
  })
})
