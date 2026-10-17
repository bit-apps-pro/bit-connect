import Quill from 'quill'
import { afterEach, describe, expect, it } from 'vitest'

import { codeExitBindings } from './quill-code-exit'

const mount = () => {
  const host = document.createElement('div')
  document.body.append(host)
  return new Quill(host, { modules: { keyboard: { bindings: codeExitBindings } } })
}

const press = (quill: Quill, key: string) => {
  quill.root.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }))
}

/** Each line's text and whether it is code, in order. */
const lines = (quill: Quill) =>
  quill.getLines().map(line => [quill.getText(quill.getIndex(line), line.length() - 1), Boolean(line.formats()['code-block'])])

afterEach(() => {
  document.body.innerHTML = ''
})

describe('codeExitBindings', () => {
  it('Enter on an empty last line of a code block leaves the block', () => {
    const quill = mount()
    quill.setContents([{ insert: 'x = 1' }, { attributes: { 'code-block': 'plain' }, insert: '\n\n' }])
    quill.setSelection(6, 0)

    press(quill, 'Enter')

    expect(lines(quill)).toEqual([
      ['x = 1', true],
      ['', false]
    ])
  })

  it('a blank line in the middle of a block stays code', () => {
    const quill = mount()
    quill.setContents([
      { insert: 'a' },
      { attributes: { 'code-block': 'plain' }, insert: '\n\n' },
      { insert: 'b' },
      { attributes: { 'code-block': 'plain' }, insert: '\n' }
    ])
    quill.setSelection(2, 0)

    press(quill, 'Enter')

    expect(lines(quill).every(([, code]) => code)).toBe(true)
  })

  it('ArrowDown on a block that ends the post opens a paragraph below it', () => {
    const quill = mount()
    quill.setContents([{ insert: 'x = 1' }, { attributes: { 'code-block': 'plain' }, insert: '\n' }])
    quill.setSelection(3, 0)

    press(quill, 'ArrowDown')

    expect(lines(quill)).toEqual([
      ['x = 1', true],
      ['', false]
    ])
    expect(quill.getSelection()?.index).toBe(6)
  })

  it('ArrowDown with a line below the block is left alone', () => {
    const quill = mount()
    quill.setContents([{ insert: 'x = 1' }, { attributes: { 'code-block': 'plain' }, insert: '\n' }, { insert: 'after\n' }])
    quill.setSelection(3, 0)

    press(quill, 'ArrowDown')

    expect(lines(quill)).toEqual([
      ['x = 1', true],
      ['after', false]
    ])
  })
})
