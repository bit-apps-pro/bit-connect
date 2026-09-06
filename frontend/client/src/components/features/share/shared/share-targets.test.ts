import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildShareUrl,
  canShareNatively,
  commentAnchorId,
  commentFragment,
  commentIdFromFragment,
  PRIMARY_SHARE_CHANNELS,
  SHARE_CHANNELS
} from './share-targets'

vi.mock('@config/config', () => ({
  default: { POST_URL: '/community', SITE_URL: 'https://example.com' }
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the share channels', () => {
  it('offers every network the row and the dialog between them show', () => {
    expect(SHARE_CHANNELS.map(channel => channel.key)).toEqual([
      'x',
      'facebook',
      'linkedin',
      'whatsapp',
      'reddit',
      'telegram',
      'email'
    ])
  })

  // A row long enough to hold all seven stops being a share affordance and
  // becomes a toolbar. The rest stay one click away rather than being dropped.
  it('promotes four of them to the row in the page', () => {
    expect(PRIMARY_SHARE_CHANNELS.map(channel => channel.key)).toEqual([
      'x',
      'facebook',
      'linkedin',
      'whatsapp'
    ])
  })

  // Derived rather than a second list, so the two can never name different URLs.
  it('takes the promoted four from the same list the dialog renders', () => {
    for (const channel of PRIMARY_SHARE_CHANNELS) {
      expect(SHARE_CHANNELS).toContain(channel)
    }
  })

  // A title with an ampersand or a hash in it would otherwise truncate the
  // shared text or break the URL outright.
  it('escapes the link and the title into every share URL', () => {
    const url = 'https://example.com/community/billing?a=1&b=2'
    const title = 'Billing & VAT #2'

    for (const channel of SHARE_CHANNELS) {
      const href = channel.href(url, title)

      expect(href).not.toContain('?a=1&b=2')
      expect(href).toContain(encodeURIComponent(url))
    }
  })

  // Plain intent URLs rather than each network's SDK: an embedded script per
  // network is a consent problem in the EU and a tracker on every forum page.
  it('sends people to the networks over plain https, with no SDK behind it', () => {
    for (const channel of SHARE_CHANNELS.filter(one => one.key !== 'email')) {
      expect(channel.href('https://example.com/x', 'Title').startsWith('https://')).toBe(true)
    }
  })

  // A webmail composer would assume Gmail; mailto: opens whichever client the
  // reader actually uses.
  it('hands email to the reader’s own client', () => {
    const href = SHARE_CHANNELS.find(channel => channel.key === 'email')!.href(
      'https://example.com/x',
      'Title'
    )

    expect(href.startsWith('mailto:?')).toBe(true)
    expect(href).toContain(encodeURIComponent('Title'))
  })

  // WhatsApp takes one `text` field, so the link is appended to the title
  // rather than passed separately.
  it('folds the link into the text for WhatsApp', () => {
    const href = SHARE_CHANNELS.find(channel => channel.key === 'whatsapp')!.href(
      'https://example.com/x',
      'Title'
    )

    expect(href).toContain(encodeURIComponent('Title https://example.com/x'))
  })

  // Brand colours identify a company rather than express the interface's
  // palette, so they must not flip with the theme.
  it('gives every channel a literal brand colour rather than a theme token', () => {
    for (const channel of SHARE_CHANNELS) {
      expect(channel.brand).toMatch(/^#[\da-f]{6}$/i)
      expect(channel.label).not.toBe('')
    }
  })

  // X is black on white and would otherwise be a black glyph on a near-black
  // disc.
  it('overrides only the colour that disappears on a dark surface', () => {
    const withOverride = SHARE_CHANNELS.filter(channel => channel.brandDark)

    expect(withOverride.map(channel => channel.key)).toEqual(['x'])
  })
})

// `#comment-{id}` is WordPress's own fragment for a comment — what
// get_comment_link() has always produced — so notification and report links
// written before the portal answered to it land in the same place as one copied
// from the Share dialog today.
describe('the comment fragment', () => {
  it('is the one WordPress itself writes', () => {
    expect(commentFragment(42)).toBe('#comment-42')
    expect(commentAnchorId(42)).toBe('comment-42')
  })

  it('reads the comment back out of a fragment', () => {
    expect(commentIdFromFragment('#comment-42')).toBe(42)
    expect(commentIdFromFragment('comment-42')).toBe(42)
  })

  // The fragment comes from whatever link was clicked, so `#comment-abc` has to
  // become "no target" rather than a lookup for NaN.
  it('rejects a fragment whose tail is not a plain id', () => {
    expect(commentIdFromFragment('#comment-abc')).toBeUndefined()
    expect(commentIdFromFragment('#comment-')).toBeUndefined()
    expect(commentIdFromFragment('#comment-1.5')).toBeUndefined()
    expect(commentIdFromFragment('#comment-42-extra')).toBeUndefined()
    expect(commentIdFromFragment('#respond')).toBeUndefined()
    expect(commentIdFromFragment('')).toBeUndefined()
  })

  it('rejects comment zero', () => {
    expect(commentIdFromFragment('#comment-0')).toBeUndefined()
  })

  it('rejects an id too large to be a real one', () => {
    expect(commentIdFromFragment('#comment-99999999999999999999')).toBeUndefined()
  })
})

// Built through the portal's own URL builder rather than from window.location,
// so it carries the portal page basename — the part React Router hides from
// `pathname` and the part a shared link cannot do without.
describe('buildShareUrl', () => {
  it('builds an absolute URL that keeps the portal basename', () => {
    expect(buildShareUrl('billing-question')).toBe('https://example.com/community/billing-question')
  })

  it('points at one reply inside the topic when given a comment', () => {
    expect(buildShareUrl('billing-question', 42)).toBe(
      'https://example.com/community/billing-question#comment-42'
    )
  })

  // WordPress percent-encodes anything outside ASCII in `post_name`, and that
  // escaped form is what the route matches.
  it('passes the slug through exactly as it is stored', () => {
    expect(buildShareUrl('hello-%f0%9f%94%a5')).toBe('https://example.com/community/hello-%f0%9f%94%a5')
  })
})

describe('canShareNatively', () => {
  it('is true where the browser has a share sheet', () => {
    vi.stubGlobal('navigator', { share: () => Promise.resolve() })

    expect(canShareNatively()).toBe(true)
  })

  it('is false where it does not', () => {
    vi.stubGlobal('navigator', {})

    expect(canShareNatively()).toBe(false)
  })
})
