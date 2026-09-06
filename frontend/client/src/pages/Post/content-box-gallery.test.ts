import { describe, expect, it } from 'vitest'

import { isGallery } from './ContentBox'

const image = (name: string) => `<img src="https://site.test/wp-content/uploads/2026/08/${name}.png">`

describe('isGallery', () => {
  it('treats an uninterrupted run of pictures as a gallery', () => {
    // What the thumbnail collage was written for: several shots pasted in one
    // go, which at full width would bury the text under screens of scrolling.
    expect(isGallery(`<p>Look at these</p><p>${image('a')}${image('b')}${image('c')}</p>`)).toBe(true)
  })

  it('is not a gallery when prose separates the pictures', () => {
    // The case that sent a written answer to the collage and cropped both of its
    // screenshots to a 160px square. Each picture belongs to the paragraph above
    // it, so each is sized like a lone one.
    const html = [
      '<p>Yes, there is a client portal.</p>',
      `<p><figure>${image('portal')}</figure></p>`,
      '<p>An administrator controls what each client can see.</p>',
      `<p><figure>${image('settings')}</figure></p>`
    ].join('')

    expect(isGallery(html)).toBe(false)
  })

  it('ignores markup and blank space between adjacent pictures', () => {
    // Two figures back to back are still a run: what sits between them is only
    // the wrappers the block editor emits, not something the reader sees.
    const html = `<figure>${image('a')}</figure>\n  <figure>${image('b')}</figure>`

    expect(isGallery(html)).toBe(true)
  })

  it('needs more than one picture', () => {
    expect(isGallery(`<p>Here it is</p>${image('only')}`)).toBe(false)
    expect(isGallery('<p>No pictures at all</p>')).toBe(false)
  })

  it('counts a non-breaking space as text, not as a gap in a run', () => {
    // &nbsp; is what an editor leaves behind between two blocks; it reads as
    // empty on the page, so it must not be what makes a gallery stop being one.
    expect(isGallery(`${image('a')}&nbsp;${image('b')}`)).toBe(true)
  })

  it('does not mistake a caption for empty markup', () => {
    const html = `<figure>${image('a')}<figcaption>The dashboard</figcaption></figure><figure>${image('b')}</figure>`

    expect(isGallery(html)).toBe(false)
  })
})
