import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { __ } from '../../../common/helpers/i18nWrap'
import TextArea from './TextArea'

describe('TextArea component', () => {
  afterEach(cleanup)

  it('renders the label', () => {
    render(<TextArea label={__('Description')} />)
    expect(screen.getByText('Description')).toBeTruthy()
  })

  it('marks a required field with an asterisk', () => {
    render(<TextArea label={__('Description')} required />)
    expect(screen.getByText('*')).toBeTruthy()
  })

  it('renders the textarea control', () => {
    render(<TextArea placeholder={__('Write here')} />)
    const control = screen.getByPlaceholderText('Write here')
    expect(control.nodeName).toBe('TEXTAREA')
  })

  it('shows the invalid message on error status', () => {
    render(<TextArea invalidMessage={__('Too short')} status="error" />)
    expect(screen.getByText('Too short')).toBeTruthy()
  })

  it('shows helper text when there is no invalid message', () => {
    render(<TextArea helperText={__('Max 500 chars')} />)
    expect(screen.getByText('Max 500 chars')).toBeTruthy()
  })
})
