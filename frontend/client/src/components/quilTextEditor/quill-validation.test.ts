import { describe, expect, it } from 'vitest'

import { cleanPastedHtml, sanitizeHtml, sanitizeNode } from './quill-validation'

/** The paste pipeline: Word/Docs cleanup, then DOM sanitization. */
const paste = (html: string) => sanitizeHtml(cleanPastedHtml(html))

describe('sanitizeHtml', () => {
  it('keeps the content of a paste, not just its text', () => {
    // Browsers wrap copied content in <div>s. Collapsing those to textContent
    // used to throw away every image and every bit of formatting inside them.
    const result = paste('<div><p>Before</p><img src="https://e.com/a.png"><p>After</p></div>')

    expect(result).toBe('<p>Before</p><img src="https://e.com/a.png"><p>After</p>')
  })

  it('keeps an image that is the only thing inside a wrapper', () => {
    expect(paste('<div><img src="https://e.com/only.png"></div>')).toBe(
      '<p><img src="https://e.com/only.png"></p>'
    )
  })

  it('keeps each block container on its own line', () => {
    expect(paste('<div>line one</div><div>line two</div>')).toBe('<p>line one</p><p>line two</p>')
  })

  it('preserves inline formatting and links nested deep inside wrappers', () => {
    expect(paste('<section><article><p>a <b>b</b> <i>c</i></p></article></section>')).toBe(
      '<p>a <b>b</b> <i>c</i></p>'
    )
  })

  it('preserves lists and tables lifted out of a wrapper', () => {
    expect(paste('<div><ul><li>one</li><li>two</li></ul></div>')).toBe(
      '<ul><li>one</li><li>two</li></ul>'
    )
  })

  it('returns markup rather than throwing when handed a whole document body', () => {
    // Regression: passing <body> itself to sanitizeNode removed the body,
    // leaving doc.body null and taking the entire paste with it.
    expect(() => paste('<html><body><p>Hi</p></body></html>')).not.toThrow()
    expect(paste('<html><body><p>Hi</p></body></html>')).toBe('<p>Hi</p>')
  })

  it('leaves <body> in place when it is sanitized directly', () => {
    const doc = new DOMParser().parseFromString('<p>Hi</p>', 'text/html')
    sanitizeNode(doc.body)

    expect(doc.body).not.toBeNull()
    expect(doc.body.innerHTML).toBe('<p>Hi</p>')
  })
})

describe('sanitizeHtml — untrusted markup', () => {
  it('drops a script along with its source', () => {
    const result = paste('<div>safe<script>alert(1)</script></div>')

    expect(result).toBe('<p>safe</p>')
    expect(result).not.toContain('alert')
  })

  it('drops style and iframe contents', () => {
    expect(paste('<div><style>.x{color:red}</style>visible</div>')).toBe('<p>visible</p>')
    expect(paste('<div>a<iframe>framed</iframe>b</div>')).toBe('<p>ab</p>')
  })

  it('strips event handler attributes', () => {
    expect(paste('<img src="https://e.com/i.png" onerror="alert(1)">')).toBe(
      '<img src="https://e.com/i.png">'
    )
  })

  it('strips javascript: hrefs', () => {
    expect(paste('<a href="javascript:alert(1)">click</a>')).toBe('<a>click</a>')
  })

  it('removes images the editor cannot keep, so the upload path handles them', () => {
    // file:// and data: sources cannot be rendered by anyone else. Dropping them
    // is what makes the clipboard's own image file worth uploading instead.
    expect(paste('<div><img src="file:///tmp/x.png"></div>')).toBe('')
    expect(paste('<img src="data:image/png;base64,AAAA">')).toBe('')
  })

  it('marks external links safe to open', () => {
    expect(paste('<a href="https://x.com">link</a>')).toBe(
      '<a href="https://x.com" rel="noopener noreferrer" target="_blank">link</a>'
    )
  })
})
