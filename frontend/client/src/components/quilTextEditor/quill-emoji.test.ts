import { describe, expect, it } from 'vitest'

import { formatCommentForWordPress } from './quill-comment-formatter'
import { countEmoji, emojiTextFor, isEmojiImage, isEmojiOnly, replaceEmojiImages } from './quill-emoji'
import { sanitizeHtml, validateContent } from './quill-validation'

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')
const img = (html: string) => parse(html).body.querySelector('img')!

describe('isEmojiImage', () => {
  it('recognises the class WordPress puts on its replacements', () => {
    expect(isEmojiImage(img('<img class="emoji" src="https://x.test/a.png">'))).toBe(true)
    expect(isEmojiImage(img('<img class="wp-smiley" src="https://x.test/a.png">'))).toBe(true)
  })

  it('recognises the sprite path once the class has been stripped', () => {
    // This is the state a stored comment is in: the formatters keep only
    // src and alt, so the class is long gone by the time anything renders it.
    expect(isEmojiImage(img('<img src="https://s.w.org/images/core/emoji/16.0.1/svg/1f600.svg">'))).toBe(
      true
    )
  })

  it('leaves an ordinary uploaded picture alone', () => {
    expect(isEmojiImage(img('<img src="https://site.test/wp-content/uploads/2026/08/1.png">'))).toBe(
      false
    )
  })
})

describe('emojiTextFor', () => {
  it('prefers the alt WordPress writes', () => {
    expect(emojiTextFor(img('<img class="emoji" alt="😀" src="https://x.test/1f600.svg">'))).toBe('😀')
  })

  it('decodes the codepoints in the filename when alt was lost', () => {
    expect(emojiTextFor(img('<img src="https://s.w.org/images/core/emoji/16.0.1/svg/1f600.svg">'))).toBe(
      '😀'
    )
  })

  it('decodes a multi-codepoint sequence such as a flag', () => {
    expect(
      emojiTextFor(img('<img src="https://s.w.org/images/core/emoji/16.0.1/svg/1f1e7-1f1e9.svg">'))
    ).toBe('🇧🇩')
  })

  it('ignores an alt that is a description rather than the character', () => {
    expect(
      emojiTextFor(img('<img alt="smiling face" src="https://s.w.org/images/core/emoji/svg/1f600.svg">'))
    ).toBe('😀')
  })
})

describe('replaceEmojiImages', () => {
  it('puts the character back and leaves real pictures in place', () => {
    const doc = parse(
      '<p>Nice <img class="emoji" alt="👍" src="https://s.w.org/images/core/emoji/svg/1f44d.svg"> work</p>' +
        '<p><img src="https://site.test/uploads/shot.png" alt="shot"></p>'
    )

    expect(replaceEmojiImages(doc.body)).toBe(1)
    expect(doc.body.innerHTML).toBe(
      '<p>Nice 👍 work</p><p><img src="https://site.test/uploads/shot.png" alt="shot"></p>'
    )
  })
})

describe('countEmoji', () => {
  it('counts a flag, a keycap and a skin-toned face as one each', () => {
    expect(countEmoji('🇧🇩')).toBe(1)
    expect(countEmoji('👍🏽')).toBe(1)
    expect(countEmoji('😀 🎉 👍')).toBe(3)
  })

  it('counts a zero-width-joined family as the single character it renders as', () => {
    expect(countEmoji('👨‍👩‍👧')).toBe(1)
  })
})

describe('isEmojiOnly', () => {
  it('is true for a short reaction', () => {
    expect(isEmojiOnly('🎉')).toBe(true)
    expect(isEmojiOnly('😀 🎉 👍')).toBe(true)
  })

  it('is false once there are words, or a crowd of emoji', () => {
    expect(isEmojiOnly('nice 👍')).toBe(false)
    expect(isEmojiOnly('😀🎉👍😀🎉')).toBe(false)
    expect(isEmojiOnly('')).toBe(false)
  })

  it('does not treat ordinary punctuation as a reaction', () => {
    // © and ™ are Extended_Pictographic, but a comment of "©" is text.
    expect(isEmojiOnly('©')).toBe(false)
  })
})

describe('emoji through the comment pipeline', () => {
  it('stores the character rather than a sprite the styles size like a photo', () => {
    // Regression: the formatter strips every attribute but src/alt, so a
    // WordPress emoji replacement lost the class core sizes it by and the
    // comment styles rendered a 😀 as a 200px block image.
    const result = formatCommentForWordPress(
      '<p>Great <img class="emoji" alt="😀" src="https://s.w.org/images/core/emoji/16.0.1/svg/1f600.svg"> news</p>'
    )

    expect(result).toBe('<p>Great 😀 news</p>')
    expect(result).not.toContain('<img')
  })

  it('repairs a comment already stored with a bare emoji sprite', () => {
    expect(sanitizeHtml('<p>ok <img src="https://s.w.org/images/core/emoji/svg/1f44d.svg"></p>')).toBe(
      '<p>ok 👍</p>'
    )
  })
})

describe('validateContent', () => {
  it('does not count emoji against the image limit', () => {
    // Regression: six emoji tripped "Too many images" on a draft with none.
    const emoji = Array.from(
      { length: 6 },
      (_, i) => `<img class="emoji" alt="😀" src="https://s.w.org/images/core/emoji/svg/1f60${i}.svg">`
    ).join('')

    expect(validateContent(`<p>hi ${emoji}</p>`).errors).toEqual([])
  })

  it('accepts a draft holding the upload placeholder', () => {
    // Regression: the unanchored on\w+= pattern matched "contenteditable=",
    // so clicking Comment mid-upload failed with "disallowed code" and the
    // picture was lost.
    const draft =
      '<p>look<span class="ql-image-loading" contenteditable="false" role="progressbar">x</span></p>'

    expect(validateContent(draft).valid).toBe(true)
  })

  it('still rejects a real inline event handler', () => {
    expect(validateContent('<p onclick="alert(1)">hi</p>').valid).toBe(false)
    expect(validateContent('<img src="https://x.test/a.png" onerror="alert(1)">').valid).toBe(false)
  })
})
