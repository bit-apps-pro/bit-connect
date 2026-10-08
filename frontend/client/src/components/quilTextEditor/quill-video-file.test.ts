import { describe, expect, it } from 'vitest'

import { unwrapVideoFigures } from './quill-video-file'

describe('unwrapVideoFigures', () => {
  it('reads a stored video without the figure the formatter wrapped it in', () => {
    expect(
      unwrapVideoFigures(
        '<p>Watch</p>\n<figure class="wp-block-video"><video src="https://e.com/clip.mp4" controls=""></video></figure>\n<p>After</p>'
      )
    ).toBe('<p>Watch</p>\n<video src="https://e.com/clip.mp4" controls=""></video>\n<p>After</p>')
  })

  it('leaves a picture figure, and a video with no figure, as they are', () => {
    const picture = '<figure class="wp-block-image"><img src="https://e.com/a.png" alt=""></figure>'
    const bare = '<video src="https://e.com/clip.mp4"></video>'

    expect(unwrapVideoFigures(picture)).toBe(picture)
    expect(unwrapVideoFigures(bare)).toBe(bare)
  })
})
