import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { useEffect, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BLANK_TOPIC_SEO, type TopicSeo } from '../shared/type'

vi.mock('@common/helpers/request', () => ({ uploadRequest: vi.fn() }))
vi.mock('@components/features/file-uploader/attachment-validation', () => ({
  validateAttachment: () => ({ valid: true })
}))

const { default: SearchAppearanceField, isSeoSet, isUsableImageUrl } = await import(
  './search-appearance-field'
)

/** Registered the way topic-form.tsx registers it, seeded the way the edit modal seeds it. */
function Harness({ onValues, seo }: { onValues?: (v: TopicSeo) => void; seo?: TopicSeo }) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (seo) form.setFieldValue('seo', seo)
  }, [form, seo])

  return (
    <Form form={form} onValuesChange={(_, all) => onValues?.(all.seo)}>
      <Form.Item initialValue={BLANK_TOPIC_SEO} name="seo">
        <Controlled titleFallback="How do I reset my password" />
      </Form.Item>
    </Form>
  )
}

// The open state lives in the form in production; here the wrapper owns it.
function Controlled(props: {
  id?: string
  onChange?: (v: TopicSeo) => void
  titleFallback: string
  value?: TopicSeo
}) {
  const [isOpen, setIsOpen] = useState(false)
  return <SearchAppearanceField {...props} isOpen={isOpen} onOpenChange={setIsOpen} />
}

const opener = (name: RegExp | string) => screen.getByRole('button', { name })

describe('SearchAppearanceField', () => {
  afterEach(cleanup)

  it('shows nothing but an opener until the author asks for it', () => {
    render(<Harness />)

    expect(opener('Customise search appearance')).toBeInTheDocument()
    expect(screen.queryByLabelText('Search title')).not.toBeInTheDocument()
  })

  it('opens to the three fields with the topic title as the fallback placeholder', async () => {
    render(<Harness />)

    await userEvent.click(opener('Customise search appearance'))

    expect(screen.getByLabelText('Search title')).toHaveAttribute(
      'placeholder',
      'How do I reset my password'
    )
    expect(screen.getByLabelText('Search description')).toBeInTheDocument()
    expect(screen.getByLabelText('Preview image')).toBeInTheDocument()
  })

  it('writes what is typed into the form as one seo object', async () => {
    const values: TopicSeo[] = []
    render(<Harness onValues={v => values.push(v)} />)

    await userEvent.click(opener('Customise search appearance'))
    await userEvent.type(screen.getByLabelText('Search title'), 'Reset it')
    await userEvent.type(screen.getByLabelText('Search description'), 'Two steps.')

    expect(values.at(-1)).toEqual({ description: 'Two steps.', image: '', title: 'Reset it' })
  })

  it('says so while closed when the topic is already customised', () => {
    render(<Harness seo={{ description: 'Two steps.', image: '', title: 'Reset it' }} />)

    expect(opener('Edit search appearance')).toBeInTheDocument()
    expect(screen.getByText('Reset it — Two steps.')).toBeInTheDocument()
  })

  it('cancel puts back what was there when it was opened', async () => {
    const values: TopicSeo[] = []
    render(<Harness onValues={v => values.push(v)} seo={{ ...BLANK_TOPIC_SEO, title: 'Kept' }} />)

    await userEvent.click(opener('Edit search appearance'))
    await userEvent.type(screen.getByLabelText('Search title'), ' and more')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(values.at(-1)?.title).toBe('Kept')
    expect(opener('Edit search appearance')).toBeInTheDocument()
  })

  it('refuses to fold away over an image that is not a web address', async () => {
    render(<Harness />)

    await userEvent.click(opener('Customise search appearance'))
    await userEvent.type(screen.getByLabelText('Preview image'), '/uploads/a.png')
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(screen.getByLabelText('Preview image')).toBeInTheDocument()
  })

  it('trims what it hands back on Done', async () => {
    const values: TopicSeo[] = []
    render(<Harness onValues={v => values.push(v)} />)

    await userEvent.click(opener('Customise search appearance'))
    await userEvent.type(screen.getByLabelText('Search title'), '  Reset it  ')
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(values.at(-1)?.title).toBe('Reset it')
    expect(screen.queryByLabelText('Search title')).not.toBeInTheDocument()
  })
})

describe('isUsableImageUrl', () => {
  it.each(['', 'https://example.com/a.png', 'http://example.com/a.png'])('accepts %j', url => {
    expect(isUsableImageUrl(url)).toBe(true)
  })

  it.each(['/uploads/a.png', '//example.com/a.png', 'javascript:alert(1)', 'not a url'])(
    'refuses %j',
    url => {
      expect(isUsableImageUrl(url)).toBe(false)
    }
  )
})

describe('isSeoSet', () => {
  it('is false for blank and for missing', () => {
    expect(isSeoSet(BLANK_TOPIC_SEO)).toBe(false)
    expect(isSeoSet()).toBe(false)
  })

  it('is true once any field has a value', () => {
    expect(isSeoSet({ ...BLANK_TOPIC_SEO, image: 'https://example.com/a.png' })).toBe(true)
  })
})
