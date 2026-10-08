import { describe, expect, it } from 'vitest'

import { formatCommentForWordPress } from './quill-comment-formatter'

describe('formatCommentForWordPress — uploaded videos', () => {
  it('keeps a video bare, with its file and the browser controls only', () => {
    expect(
      formatCommentForWordPress(
        '<p>Watch</p><video src="https://forum.example/wp-content/uploads/clip.mp4" controls="" preload="metadata" playsinline="" contenteditable="false" class="ql-video"></video>'
      )
    ).toBe(
      '<p>Watch</p>\n<video src="https://forum.example/wp-content/uploads/clip.mp4" controls="" preload="metadata" playsinline=""></video>'
    )
  })

  it('drops a video whose file is not a web address', () => {
    expect(formatCommentForWordPress('<p>Watch</p><video src="data:video/mp4;base64,AAAA" controls=""></video>')).toBe(
      '<p>Watch</p>'
    )
  })

  it('never keeps autoplay', () => {
    expect(
      formatCommentForWordPress('<video src="https://forum.example/clip.mp4" autoplay="" controls=""></video>')
    ).not.toContain('autoplay')
  })
})
