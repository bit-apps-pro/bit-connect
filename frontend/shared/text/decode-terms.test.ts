import { describe, expect, it } from 'vitest'

import { decodeTermFields } from './decode-terms'

describe('decodeTermFields', () => {
  it('decodes the name and description of every term in a list', () => {
    expect(
      decodeTermFields([
        { description: 'Q&amp;A', id: 34, name: 'API &amp; Integrations', taxonomy: 'bit-connect-departments' },
        { id: 35, name: 'Billing', taxonomy: 'bit-connect-departments' }
      ])
    ).toEqual([
      { description: 'Q&A', id: 34, name: 'API & Integrations', taxonomy: 'bit-connect-departments' },
      { id: 35, name: 'Billing', taxonomy: 'bit-connect-departments' }
    ])
  })

  it('decodes a single term, as a create or update returns', () => {
    expect(decodeTermFields({ id: 1, name: 'R&amp;D', taxonomy: 'bit-connect-tags' }).name).toBe('R&D')
  })

  it('leaves anything that is not a term alone', () => {
    const user = { id: 1, name: 'Tom &amp; Jerry' }

    expect(decodeTermFields(user)).toBe(user)
    expect(decodeTermFields('R&amp;D')).toBe('R&amp;D')
  })
})
