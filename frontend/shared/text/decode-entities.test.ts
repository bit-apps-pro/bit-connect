import { describe, expect, it } from 'vitest'

import { decodeEntities, htmlToText } from './decode-entities'

describe('decodeEntities', () => {
  it('decodes the ampersand WordPress stores in term names', () => {
    expect(decodeEntities('API &amp; Integrations')).toBe('API & Integrations')
  })

  it('decodes quotes, angle brackets and typographic entities', () => {
    expect(decodeEntities('&quot;Q&amp;A&quot; &lt;beta&gt; &#8211; it&#039;s &rsquo;ok&hellip;')).toBe(
      '"Q&A" <beta> – it\'s ’ok…'
    )
  })

  it('decodes hex entities', () => {
    expect(decodeEntities('caf&#xe9;')).toBe('café')
  })

  it('decodes once, so an escaped entity survives as text', () => {
    expect(decodeEntities('&amp;amp;')).toBe('&amp;')
  })

  it('leaves unknown and out-of-range entities alone', () => {
    expect(decodeEntities('&bogus; &#99999999;')).toBe('&bogus; &#99999999;')
  })

  it('returns text without entities unchanged', () => {
    expect(decodeEntities('Core Platform & more')).toBe('Core Platform & more')
  })
})

describe('htmlToText', () => {
  it('turns the WordPress critical-error markup into a sentence', () => {
    expect(
      htmlToText(
        '<p>There has been a critical error on this website.</p><p><a href="https://wordpress.org/x/">Learn more about troubleshooting WordPress.</a></p>'
      )
    ).toBe('There has been a critical error on this website. Learn more about troubleshooting WordPress.')
  })
})
