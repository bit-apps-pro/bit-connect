import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { __ } from '../../../common/helpers/i18nWrap'
import Input from './Input'

describe.concurrent('test Input component', () => {
  afterEach(cleanup)

  it('should render Input with title', () => {
    render(<Input label={__('Tag name')} />)
    const inputElm = screen.getByText('Tag name')
    expect(inputElm.textContent).toBe('Tag name')
  })
  it('should render Input without title', () => {
    render(<Input />)
    const inputElm = screen.queryByText('tag name')
    // eslint-disable-next-line unicorn/no-null
    expect(inputElm).toBe(null)
  })
  it('should render Invalid message', () => {
    render(<Input invalidMessage={__('Invalid message')} status="error" />)
    const inputElm = screen.getByText('Invalid message')
    expect(inputElm.textContent).toBe('Invalid message')
  })
  it('should render with placeholder', () => {
    render(<Input placeholder={__('Write tag name')} />)
    const inputElm = screen.getByPlaceholderText('Write tag name')
    expect(inputElm.nodeName).toBe('INPUT')
  })
  it('should render with value', () => {
    render(<Input value="This is value" />)
    const inputElm = screen.getByDisplayValue('This is value')
    expect(inputElm).toBeTruthy()
  })
})
