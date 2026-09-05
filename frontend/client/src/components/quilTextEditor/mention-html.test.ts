import { beforeEach, describe, expect, it, vi } from 'vitest'

// The href is built from the portal's basename, which is server-injected.
const config = { POST_URL: '/community', SITE_URL: 'https://example.com' }

vi.mock('@config/config', () => ({ default: config }))

const { default: Quill } = await import('quill')
// Side-effect import: registering the blot is what makes a `bc-mention` link
// convert back into a mention rather than an ordinary one.
await import('./quill-mention')
const { mentionHtml } = await import('./mention-html')

beforeEach(() => {
  config.POST_URL = '/community'
})

/** An editor holding nothing but what the markup seeded it with. */
const seed = (html: string) => {
  const container = document.createElement('div')
  document.body.append(container)

  const quill = new Quill(container, { modules: { mention: false, toolbar: false } })
  quill.setContents(quill.clipboard.convert({ html }))

  return quill
}

/**
 * What the markup has to hold is not a matter of taste: the class is how
 * MentionService tells a mention from a link to somebody's profile, and the
 * href is who gets notified.
 */
describe('mentionHtml', () => {
  it('marks the link so the server reads it as a mention', () => {
    expect(mentionHtml({ name: 'Aiden Carter', slug: 'aiden-carter' })).toBe(
      '<p><a class="bc-mention" href="/community/user/aiden-carter">Aiden Carter</a>&nbsp;</p>'
    )
  })

  it('carries the portal basename, so the link resolves where the portal answers', () => {
    config.POST_URL = '/'

    expect(mentionHtml({ name: 'Priya', slug: 'priya' })).toContain('href="/user/priya"')
  })

  it('keeps the href relative, which is what stops both sanitizers reading it as another site', () => {
    expect(mentionHtml({ name: 'Priya', slug: 'priya' })).not.toContain('https://example.com')
  })

  it('ends with a non-breaking space, which Quill keeps and an ordinary one it would trim', () => {
    expect(mentionHtml({ name: 'Priya', slug: 'priya' })).toMatch(/<\/a>&nbsp;<\/p>$/)
  })

  it('escapes a display name, which is whatever its owner typed into their profile', () => {
    const html = mentionHtml({ name: '<img src=x onerror="alert(1)">', slug: 'trouble' })

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  })

  it('escapes a slug rather than letting it close the attribute', () => {
    const html = mentionHtml({ name: 'Quote', slug: 'a"b' })

    // encodeURIComponent takes the quote first; the escape is the second line.
    expect(html).toContain('href="/community/user/a%22b"')
  })
})

/**
 * The half of the contract the markup cannot state on its own: an editor seeded
 * with it has to come back holding a mention, not a link that looks like one.
 * Both halves have been broken by a plausible-looking change — a sanitizer that
 * drops classes, or a tidy-up that turns the &nbsp; into a space Quill trims —
 * and neither shows up until somebody replies and nobody is notified.
 */
describe('an editor seeded with it', () => {
  it('reads the link back as a mention, with the profile it points at', () => {
    const quill = seed(mentionHtml({ name: 'Aiden Carter', slug: 'aiden-carter' }))

    expect(quill.getContents().ops[0]).toEqual({
      attributes: { mention: { href: '/community/user/aiden-carter' } },
      insert: 'Aiden Carter'
    })
  })

  it('leaves the caret somewhere unformatted, so the reply is not typed into the link', () => {
    const quill = seed(mentionHtml({ name: 'Aiden Carter', slug: 'aiden-carter' }))
    const end = quill.getLength() - 1

    // The &nbsp; arrives as an ordinary space, which is exactly why it has to be
    // written as an entity: an ordinary space in the markup is trimmed off the
    // end of the line, and the caret then sits inside the link.
    expect(quill.getText(end - 1, 1)).toBe(' ')
    expect(quill.getFormat(end, 0)).toEqual({})
  })
})
