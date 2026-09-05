import { describe, expect, it } from 'vitest'

import slugify from './slugify'

// This is a preview of what `sanitize_title()` will store, shown while the
// admin is still typing. It only has to agree with the server closely enough
// that the field does not visibly change on save.
describe('slugify', () => {
  it('lowercases and hyphenates a name', () => {
    expect(slugify('Billing Questions')).toBe('billing-questions')
  })

  it('drops the accents rather than the letters under them', () => {
    expect(slugify('Café Münster')).toBe('cafe-munster')
  })

  it('collapses a run of separators into one', () => {
    expect(slugify('Billing   &   Payments')).toBe('billing-payments')
  })

  it('does not leave a name hyphenated at either end', () => {
    expect(slugify('  Billing!  ')).toBe('billing')
    expect(slugify('---Billing---')).toBe('billing')
  })

  it('keeps digits, which are as addressable as letters', () => {
    expect(slugify('Release 2.4')).toBe('release-2-4')
  })

  // The field is then left blank and WordPress derives the slug itself, which
  // is the only thing that can encode a non-Latin name correctly.
  it('gives back nothing for a name with no Latin characters', () => {
    expect(slugify('বিলিং')).toBe('')
    expect(slugify('★★★')).toBe('')
  })

  it('is stable when run over its own output', () => {
    expect(slugify(slugify('Billing Questions'))).toBe('billing-questions')
  })
})
