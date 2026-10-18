import { describe, expect, it } from 'vitest'

import { contentMedia } from './content-media'

describe('contentMedia', () => {
  it('lists pictures and videos in the order they appear', () => {
    const html =
      '<figure><video src="https://x.test/a.mp4" controls></video></figure><p><img alt="" src=\'https://x.test/b.png\'></p>'

    expect(contentMedia(html)).toEqual([
      { kind: 'video', src: 'https://x.test/a.mp4' },
      { kind: 'image', src: 'https://x.test/b.png' }
    ])
  })

  it('finds nothing in text alone', () => {
    expect(contentMedia('<p>Just words</p>')).toEqual([])
  })

  it('skips an element with no source', () => {
    expect(contentMedia('<video controls></video><img alt="x">')).toEqual([])
  })
})
