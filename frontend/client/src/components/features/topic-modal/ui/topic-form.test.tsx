import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type TaxonomiesResponse } from '../data/use-taxonomies'

// The editor and the uploader pull in Quill and the file store, neither of
// which this form's own behaviour depends on.
vi.mock('@components/quilTextEditor', () => ({ default: () => <div data-testid="editor" /> }))
vi.mock('@components/quilTextEditor/quill-image-resizer', () => ({
  resizeImageIfNeeded: vi.fn()
}))
vi.mock('@features/file-uploader', () => ({ default: () => <div /> }))
vi.mock('@features/file-uploader/ui/file-list', () => ({ default: () => <div /> }))
vi.mock('@features/file-uploader/state/use-file-store', () => ({ default: () => ({ files: [] }) }))
// Which taxonomy selects the form offers is an admin setting, so the tests that
// care about the row's layout set it per render. The `mock` prefix keeps it
// reachable from the factory, which vitest hoists above this file's own code.
const mockTopicFormFields: { requireDepartment?: boolean; requireTopicType?: boolean } = {}
// Private topics are off here, as they are for any forum without the pro add-on.
// The visibility radio reads this to decide whether to offer the option at all.
const mockTopicAccess: { privateTopic?: boolean } = {}
vi.mock('@/store/admin-settings.zustand', () => ({
  useAdminSettingsStore: (selector: (s: unknown) => unknown) =>
    selector({ settings: { topicAccess: mockTopicAccess, topicFormFields: mockTopicFormFields } })
}))
// The availability check needs a query client and the network. What it reports
// is its own test's business; here it only has to not be in the way.
vi.mock('../data/use-slug-availability', () => ({
  default: (value: string) => ({ isAvailable: true, isChecking: false, resolved: value })
}))

const { default: TopicForm } = await import('./topic-form')

// TopicForm renders its own <Form>, so the harness only owns the instance and
// seeds it the way the edit modal does — after mount, not via initialValues.
function Harness({
  isEditMode,
  slug,
  taxonomies
}: {
  isEditMode?: boolean
  slug?: string
  taxonomies?: TaxonomiesResponse
}) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (slug) form.setFieldValue('post_name', slug)
  }, [form, slug])

  return <TopicForm form={form} isEditMode={isEditMode} taxonomies={taxonomies} />
}

const title = () => screen.getByLabelText('Topic Title')
const slugBox = () => screen.getByLabelText('Permalink')
const openSlugButton = (name = 'Set a custom permalink') => screen.getByRole('button', { name })

/** The slug field is hidden by default; most of these need it open. */
const openSlug = async (name?: string) => {
  await userEvent.click(openSlugButton(name))
}

describe('TopicForm slug field', () => {
  afterEach(cleanup)

  it('sits directly after the title', async () => {
    render(<Harness />)

    await openSlug()

    const labels = [...document.querySelectorAll('.ant-form-item-label label')].map(l =>
      l.textContent?.trim()
    )
    expect(labels.indexOf('Permalink')).toBe(labels.indexOf('Topic Title') + 1)
  })

  // The whole point of hiding it: an author who does not care about permalinks
  // is shown neither a control for one nor a heading announcing the idea.
  it('shows nothing but an opener until the author asks for it', () => {
    render(<Harness />)

    expect(screen.queryByPlaceholderText('topic-slug')).not.toBeInTheDocument()
    expect(screen.queryByText('Permalink')).not.toBeInTheDocument()
    expect(openSlugButton()).toBeInTheDocument()
  })

  it('offers to edit rather than to set one when the topic already has a slug', () => {
    render(<Harness isEditMode slug="original-slug" />)

    expect(openSlugButton('Edit permalink')).toBeInTheDocument()
  })

  it('follows the title while composing a new topic', async () => {
    render(<Harness />)

    await userEvent.type(title(), 'My First Topic')
    await openSlug()

    expect(slugBox()).toHaveValue('my-first-topic')
  })

  it('stops following the title once it is edited by hand', async () => {
    render(<Harness />)

    await userEvent.type(title(), 'My First')
    await openSlug()
    await userEvent.clear(slugBox())
    await userEvent.type(slugBox(), 'chosen-slug')
    await userEvent.type(title(), ' Topic')

    expect(slugBox()).toHaveValue('chosen-slug')
  })

  // Renaming a published topic must not silently move its permalink.
  it('leaves an existing slug alone when the title changes on an edit', async () => {
    render(<Harness isEditMode slug="original-slug" />)

    await userEvent.type(title(), 'A Brand New Title')
    await openSlug('Edit permalink')

    expect(slugBox()).toHaveValue('original-slug')
  })

  it('normalises what was typed once the field is left', async () => {
    render(<Harness />)

    await openSlug()
    await userEvent.type(slugBox(), '  Some Messy Slug!! ')
    await userEvent.tab()

    expect(slugBox()).toHaveValue('some-messy-slug')
  })

  it('rejects a slug that has nothing sluggable in it', async () => {
    render(<Harness />)

    await openSlug()
    await userEvent.type(slugBox(), '!!!')
    await userEvent.tab()

    expect(
      await screen.findByText('Slug must contain at least one letter or number')
    ).toBeInTheDocument()
  })

  it('puts back the slug the author started with when they cancel', async () => {
    render(<Harness isEditMode slug="original-slug" />)

    await openSlug('Edit permalink')
    await userEvent.clear(slugBox())
    await userEvent.type(slugBox(), 'second-thoughts')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await openSlug('Edit permalink')

    expect(slugBox()).toHaveValue('original-slug')
  })

  it('keeps the input open while the slug reduces to nothing', async () => {
    render(<Harness />)

    await openSlug()
    await userEvent.type(slugBox(), '!!!')
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(slugBox()).toBeInTheDocument()
  })

  it('hides itself again, keeping the normalised slug, once one is confirmed', async () => {
    render(<Harness />)

    await openSlug()
    await userEvent.type(slugBox(), 'a chosen slug')
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(screen.queryByPlaceholderText('topic-slug')).not.toBeInTheDocument()

    await openSlug()
    expect(slugBox()).toHaveValue('a-chosen-slug')
  })
})

const term = (id: number, name: string) => ({ count: 0, id, name, parent: 0, slug: name })

const taxonomies = {
  'bit-connect-departments': [],
  'bit-connect-stages': [],
  'bit-connect-statuses': [],
  'bit-connect-tags': [term(11, 'billing'), term(12, 'onboarding'), term(13, 'reporting')],
  'bit-connect-topic-types': []
} satisfies TaxonomiesResponse

// rc-select also keeps a visually hidden role="option" list holding raw values
// for screen readers, so read the rendered dropdown rows instead.
const shownTags = () =>
  [...document.querySelectorAll('.ant-select-item-option-content')].map(o => o.textContent)

const searchTags = async (query: string) => {
  const box = screen.getByLabelText('Tag')
  await userEvent.click(box)
  await userEvent.type(box, query)
}

// The two taxonomy selects share a row. Either can be switched off by an admin,
// and the one left behind should not sit at half width beside dead space.
const row = () => document.querySelector('.bc-grid')

describe('TopicForm taxonomy row', () => {
  afterEach(() => {
    cleanup()
    delete mockTopicFormFields.requireDepartment
    delete mockTopicFormFields.requireTopicType
  })

  it('splits the row when both selects are required', () => {
    mockTopicFormFields.requireDepartment = true
    mockTopicFormFields.requireTopicType = true
    render(<Harness taxonomies={taxonomies} />)

    expect(row()).toHaveClass('sm:bc-grid-cols-2')
    expect(screen.getByLabelText('Topic Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Products/Department')).toBeInTheDocument()
  })

  it('gives Topic Type the whole row when Department is switched off', () => {
    mockTopicFormFields.requireTopicType = true
    render(<Harness taxonomies={taxonomies} />)

    expect(row()).not.toHaveClass('sm:bc-grid-cols-2')
    expect(screen.queryByLabelText('Products/Department')).not.toBeInTheDocument()
  })

  it('gives Department the whole row when Topic Type is switched off', () => {
    mockTopicFormFields.requireDepartment = true
    render(<Harness taxonomies={taxonomies} />)

    expect(row()).not.toHaveClass('sm:bc-grid-cols-2')
    expect(screen.queryByLabelText('Topic Type')).not.toBeInTheDocument()
  })

  it('drops the row entirely when neither is required', () => {
    render(<Harness taxonomies={taxonomies} />)

    expect(row()).toBeNull()
  })
})

describe('TopicForm tag field', () => {
  afterEach(cleanup)

  // The options carry term ids as their values, and antd filters on the value
  // by default — searching by name used to leave the dropdown empty.
  it('narrows the dropdown by tag name', async () => {
    render(<Harness taxonomies={taxonomies} />)

    await searchTags('bill')

    expect(shownTags()).toEqual(['billing'])
  })

  it('matches on a fragment from the middle of the name', async () => {
    render(<Harness taxonomies={taxonomies} />)

    await searchTags('port')

    expect(shownTags()).toEqual(['reporting'])
  })

  it('leaves every tag on offer before anything is typed', async () => {
    render(<Harness taxonomies={taxonomies} />)

    await userEvent.click(screen.getByLabelText('Tag'))

    expect(shownTags()).toEqual(['billing', 'onboarding', 'reporting'])
  })
})
