import { describe, expect, it } from 'vitest'

import { type DescriptionAllowance, descriptionProblem } from './description-problem'

const everything: DescriptionAllowance = { canAddImage: true, canAddVideo: true, maxLength: 100 }

describe('descriptionProblem', () => {
  it('accepts written text', () => {
    expect(descriptionProblem('<p>Hello</p>', everything)).toBeUndefined()
  })

  it('accepts a picture on its own', () => {
    expect(descriptionProblem('<figure class="wp-block-image"><img src="/a.png"></figure>', everything)).toBeUndefined()
  })

  // A video placed in the text is as much a description as a picture is.
  it('accepts a video on its own', () => {
    expect(
      descriptionProblem('<figure class="wp-block-video"><video src="/a.mp4" controls></video></figure>', everything)
    ).toBeUndefined()
  })

  it('refuses an empty editor', () => {
    expect(descriptionProblem('<p><br></p>', everything)).toBe(
      'Please enter a description, or add an image or a video'
    )
  })

  it('reads non-breaking spaces as nothing written', () => {
    expect(descriptionProblem('<p>&nbsp; &nbsp;</p>', everything)).toBeDefined()
  })

  it('asks only for what the editor offers', () => {
    expect(descriptionProblem('', { ...everything, canAddVideo: false })).toBe(
      'Please enter a description or add an image'
    )
    expect(descriptionProblem('', { ...everything, canAddImage: false })).toBe(
      'Please enter a description or add a video'
    )
    expect(descriptionProblem('', { ...everything, canAddImage: false, canAddVideo: false })).toBe(
      'Please enter a description'
    )
  })

  // Posting mid-upload would save the placeholder and lose the file.
  it('holds the post while a file is still uploading', () => {
    const html = '<p>Look<span data-loading-id="img-1" role="progressbar"></span></p>'

    expect(descriptionProblem(html, everything)).toBe('Please wait for the upload to finish')
  })

  it('refuses text over the limit, counting what a reader sees rather than markup', () => {
    expect(descriptionProblem(`<p><strong>${'a'.repeat(100)}</strong></p>`, everything)).toBeUndefined()
    expect(descriptionProblem(`<p>${'a'.repeat(101)}</p>`, everything)).toBe(
      'Description cannot exceed 100 characters'
    )
  })
})
