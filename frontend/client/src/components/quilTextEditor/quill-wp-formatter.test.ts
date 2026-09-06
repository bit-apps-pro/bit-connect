import { describe, expect, it } from 'vitest'

import { formatForWordPress } from './quill-wp-formatter'

describe('formatForWordPress headings', () => {
  it('keeps the level the author picked from the toolbar', () => {
    // The select writes h2/h3/h4; each has to reach post_content unchanged, or
    // the outline the author built collapses on the published page.
    expect(formatForWordPress('<h2>Heading</h2>')).toContain('<h2')
    expect(formatForWordPress('<h3>Subheading</h3>')).toContain('<h3')
    expect(formatForWordPress('<h4>Small heading</h4>')).toContain('<h4')
  })

  it('tags headings with the Gutenberg class so theme typography applies', () => {
    expect(formatForWordPress('<h2>Heading</h2>')).toBe('<h2 class="wp-block-heading">Heading</h2>')
  })

  it('drops the ql- classes Quill leaves on a heading', () => {
    // ContentSanitizerService allows class on headings, so anything left here
    // is stored verbatim in post_content.
    const result = formatForWordPress('<h3 class="ql-align-center ql-indent-1">Sub</h3>')

    expect(result).not.toContain('ql-')
    expect(result).toBe('<h3 class="wp-block-heading">Sub</h3>')
  })

  it('keeps inline formatting inside a heading', () => {
    expect(formatForWordPress('<h2>Plan <strong>B</strong></h2>')).toBe(
      '<h2 class="wp-block-heading">Plan <strong>B</strong></h2>'
    )
  })

  it('keeps headings and paragraphs as separate blocks', () => {
    expect(formatForWordPress('<h2>Title</h2><p>Body</p>')).toBe(
      '<h2 class="wp-block-heading">Title</h2>\n<p>Body</p>'
    )
  })
})

describe('formatForWordPress lists', () => {
  // Quill 2 hands over every list as <ol data-list="…"> and finalCleanup drops
  // that attribute, so without the split in quill-list-normalizer.ts a bullet
  // list would be published — and stored — as a numbered one.
  it('publishes a bulleted list as a <ul>', () => {
    const quill = '<ol><li data-list="bullet">one</li><li data-list="bullet">two</li></ol>'

    expect(formatForWordPress(quill)).toBe('<ul class="wp-block-list"><li>one</li><li>two</li></ul>')
  })

  it('publishes a numbered list as an <ol>', () => {
    const quill = '<ol><li data-list="ordered">one</li><li data-list="ordered">two</li></ol>'

    expect(formatForWordPress(quill)).toBe('<ol class="wp-block-list"><li>one</li><li>two</li></ol>')
  })

  it('never leaves data-list behind — wp_kses would drop it anyway', () => {
    const quill = '<ol><li data-list="bullet">one</li></ol>'

    expect(formatForWordPress(quill)).not.toContain('data-list')
  })

  it('treats a task-list item as a bullet, the marker it draws', () => {
    const quill = '<ol><li data-list="unchecked">todo</li></ol>'

    expect(formatForWordPress(quill)).toBe('<ul class="wp-block-list"><li>todo</li></ul>')
  })

  it('splits a list the author mixed into one run per marker style', () => {
    const quill = '<ol><li data-list="bullet">a</li><li data-list="ordered">b</li></ol>'

    expect(formatForWordPress(quill)).toBe(
      '<ul class="wp-block-list"><li>a</li></ul>\n<ol class="wp-block-list"><li>b</li></ol>'
    )
  })

  // Indenting with Tab is the ordinary way to write a sub-point, and Quill
  // records it as a class on a flat sibling rather than as real nesting.
  it('nests an indented item under the item above it', () => {
    const quill =
      '<ol><li data-list="bullet">parent</li><li data-list="bullet" class="ql-indent-1">child</li></ol>'

    expect(formatForWordPress(quill)).toBe(
      '<ul class="wp-block-list"><li>parent<ul class="wp-block-list"><li>child</li></ul></li></ul>'
    )
  })

  it('returns to the outer list when the author outdents again', () => {
    const quill = [
      '<ol>',
      '<li data-list="bullet">first</li>',
      '<li data-list="bullet" class="ql-indent-1">under first</li>',
      '<li data-list="bullet">second</li>',
      '</ol>'
    ].join('')

    expect(formatForWordPress(quill)).toBe(
      '<ul class="wp-block-list">' +
        '<li>first<ul class="wp-block-list"><li>under first</li></ul></li>' +
        '<li>second</li>' +
        '</ul>'
    )
  })

  it('leaves a pasted list alone — it already says what it is', () => {
    expect(formatForWordPress('<ul><li>pasted</li></ul>')).toBe(
      '<ul class="wp-block-list"><li>pasted</li></ul>'
    )
  })
})

describe('formatForWordPress code blocks', () => {
  it('stores a code block as Gutenberg does, wrapping the source in <code>', () => {
    expect(formatForWordPress('<pre>wp_die();</pre>')).toBe(
      '<pre class="wp-block-code"><code>wp_die();</code></pre>'
    )
  })

  it('keeps the newlines that make a pasted snippet readable', () => {
    const result = formatForWordPress('<pre>if ( $x ) {\n  return;\n}</pre>')

    expect(result).toContain('if ( $x ) {\n  return;\n}')
  })

  it('drops the spellcheck attribute Quill puts on the container', () => {
    expect(formatForWordPress('<pre spellcheck="false">code</pre>')).not.toContain('spellcheck')
  })

  // What Quill's serialiser actually hands over, newline padding and all.
  it('stores the snippet without the blank lines Quill pads it with', () => {
    const quill = '<pre data-language="plain">\nwp_die();\n</pre>'

    expect(formatForWordPress(quill)).toBe('<pre class="wp-block-code"><code>wp_die();</code></pre>')
  })

  it('keeps blank lines the author typed inside the snippet', () => {
    const quill = '<pre data-language="plain">\nconst a = 1;\n\nconst b = 2;\n</pre>'

    expect(formatForWordPress(quill)).toContain('const a = 1;\n\nconst b = 2;')
  })

  it('drops data-language — wp_kses would not store it', () => {
    expect(formatForWordPress('<pre data-language="plain">\ncode\n</pre>')).not.toContain(
      'data-language'
    )
  })
})
