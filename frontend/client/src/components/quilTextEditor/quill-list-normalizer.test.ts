import { describe, expect, it } from 'vitest'

import { formatCommentForWordPress } from './quill-comment-formatter'
import { normalizeQuillLists } from './quill-list-normalizer'

/** Run the normalizer over a fragment and hand back what it became. */
function normalize(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  normalizeQuillLists(doc.body)
  return doc.body.innerHTML
}

describe('normalizeQuillLists', () => {
  it("turns Quill's bullet container into a real <ul>", () => {
    expect(normalize('<ol><li data-list="bullet">a</li></ol>')).toBe('<ul><li>a</li></ul>')
  })

  it('leaves a numbered container as an <ol>', () => {
    expect(normalize('<ol><li data-list="ordered">a</li></ol>')).toBe('<ol><li>a</li></ol>')
  })

  it('keeps consecutive items of one kind in a single list', () => {
    expect(normalize('<ol><li data-list="bullet">a</li><li data-list="bullet">b</li></ol>')).toBe(
      '<ul><li>a</li><li>b</li></ul>'
    )
  })

  it('starts a new list where the marker style changes', () => {
    const html = normalize(
      '<ol><li data-list="bullet">a</li><li data-list="ordered">b</li><li data-list="bullet">c</li></ol>'
    )

    expect(html).toBe('<ul><li>a</li></ul><ol><li>b</li></ol><ul><li>c</li></ul>')
  })

  it('nests an indented item and removes the class that carried the depth', () => {
    const html = normalize(
      '<ol><li data-list="bullet">a</li><li data-list="bullet" class="ql-indent-1">a1</li></ol>'
    )

    expect(html).toBe('<ul><li>a<ul><li>a1</li></ul></li></ul>')
    expect(html).not.toContain('ql-indent')
  })

  it('nests two levels deep', () => {
    const html = normalize(
      [
        '<ol>',
        '<li data-list="bullet">a</li>',
        '<li data-list="bullet" class="ql-indent-1">b</li>',
        '<li data-list="bullet" class="ql-indent-2">c</li>',
        '</ol>'
      ].join('')
    )

    expect(html).toBe('<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>')
  })

  it('treats an indented first item as top level — there is nothing to hang it from', () => {
    expect(normalize('<ol><li data-list="bullet" class="ql-indent-1">only</li></ol>')).toBe(
      '<ul><li>only</li></ul>'
    )
  })

  it('does not touch a pasted list that carries no data-list', () => {
    expect(normalize('<ol><li>a</li></ol>')).toBe('<ol><li>a</li></ol>')
  })
})

describe('comment lists', () => {
  // The comment editor shares the same toolbar, so the same markup has to
  // survive the comment formatter's stricter walk.
  it('stores a bulleted comment list as a <ul>', () => {
    expect(formatCommentForWordPress('<ol><li data-list="bullet">a</li></ol>')).toBe(
      '<ul><li>a</li></ul>'
    )
  })

  it('stores a numbered comment list as an <ol>', () => {
    expect(formatCommentForWordPress('<ol><li data-list="ordered">a</li></ol>')).toBe(
      '<ol><li>a</li></ol>'
    )
  })

  it('nests an indented comment item', () => {
    expect(
      formatCommentForWordPress(
        '<ol><li data-list="bullet">a</li><li data-list="bullet" class="ql-indent-1">b</li></ol>'
      )
    ).toBe('<ul><li>a<ul><li>b</li></ul></li></ul>')
  })
})
