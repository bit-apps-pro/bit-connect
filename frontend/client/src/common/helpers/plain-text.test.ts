import { describe, expect, it } from 'vitest'

import { decodeEntities, plainText } from './plain-text'

describe('plainText', () => {
  it('strips tags and decodes the entities the editor writes', () => {
    expect(plainText('<p>What is wrong with you man&gt;&gt;</p><p>peeekk uuu</p>')).toBe(
      'What is wrong with you man>> peeekk uuu'
    )
  })

  it('decodes numeric references and nbsp', () => {
    expect(plainText('It&#039;s&nbsp;fine &#x1F600; &amp; done')).toBe("It's fine 😀 & done")
  })

  it('decodes once, so a member who typed an entity keeps it', () => {
    expect(decodeEntities('&amp;gt;')).toBe('&gt;')
  })

  it('leaves unknown or invalid references alone', () => {
    expect(decodeEntities('&bogus; &#0; &#x110000;')).toBe('&bogus; &#0; &#x110000;')
  })
})
