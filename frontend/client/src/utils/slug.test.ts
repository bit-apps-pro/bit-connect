import { describe, expect, it } from 'vitest'

import { isSameSlug, slugify, slugRedirectPath } from './slug'

// The encoded strings below are what `sanitize_title()` actually stores for
// these titles — the router hands the decoded halves back from the same URL.
describe('isSameSlug', () => {
  it('matches an emoji slug against the decoded route param', () => {
    expect(isSameSlug('emoji-slug-probe-%f0%9f%94%a5-test', 'emoji-slug-probe-🔥-test')).toBe(true)
  })

  it('matches a non-Latin slug the same way', () => {
    expect(
      isSameSlug('%e0%a6%b8%e0%a6%ae%e0%a6%b8%e0%a7%8d%e0%a6%af%e0%a6%be-%f0%9f%98%80', 'সমস্যা-😀')
    ).toBe(true)
  })

  it('matches when both sides are already in the same form', () => {
    expect(isSameSlug('plain-ascii-topic', 'plain-ascii-topic')).toBe(true)
    expect(isSameSlug('hello-%f0%9f%94%a5', 'hello-%f0%9f%94%a5')).toBe(true)
  })

  it('still separates two different topics', () => {
    expect(isSameSlug('first-topic', 'second-topic')).toBe(false)
    expect(isSameSlug('hello-%f0%9f%94%a5', 'hello-%f0%9f%98%80')).toBe(false)
  })

  it('falls back to a raw comparison when a slug is not valid encoding', () => {
    expect(isSameSlug('100%-done', '100%-done')).toBe(true)
    expect(isSameSlug('100%-done', '50%-done')).toBe(false)
  })

  it('rejects an empty route param', () => {
    expect(isSameSlug('hello-%f0%9f%94%a5', '')).toBe(false)
  })
})

// Renaming a topic used to leave the address bar on the old slug, which the
// details page then refused to match — it sat on the skeleton indefinitely.
describe('slugRedirectPath', () => {
  it('moves the topic page onto the new slug', () => {
    expect(slugRedirectPath('/old-slug', 'old-slug', 'new-slug')).toBe('/new-slug')
  })

  it('follows the slug the server settled on, not the one that was typed', () => {
    expect(slugRedirectPath('/old-slug', 'old-slug', 'new-slug-2')).toBe('/new-slug-2')
  })

  it('stays put when the slug did not move', () => {
    expect(slugRedirectPath('/same-slug', 'same-slug', 'same-slug')).toBeUndefined()
  })

  it('stays put when the response carries no slug', () => {
    expect(slugRedirectPath('/old-slug', 'old-slug', '')).toBeUndefined()
  })

  // The modal lives in the layout, so it can be submitted from a page that is
  // not the topic's own — that reader must not be yanked onto it.
  it('leaves any other page where it is', () => {
    expect(slugRedirectPath('/', 'old-slug', 'new-slug')).toBeUndefined()
    expect(slugRedirectPath('/some-other-topic', 'old-slug', 'new-slug')).toBeUndefined()
  })

  // The route arrives decoded or encoded depending on how the page was reached,
  // while the stored slug is always encoded — comparing them raw never matches.
  it('recognises the current route in either slug encoding', () => {
    expect(
      slugRedirectPath('/সমস্যা', '%e0%a6%b8%e0%a6%ae%e0%a6%b8%e0%a7%8d%e0%a6%af%e0%a6%be', 'moved')
    ).toBe('/moved')
    expect(slugRedirectPath('/hello-🔥', 'hello-%f0%9f%94%a5', 'moved')).toBe('/moved')
  })
})

describe('slugify', () => {
  it('lowercases a title and joins its words with hyphens', () => {
    expect(slugify('My First Topic')).toBe('my-first-topic')
  })

  it('folds accents down to their base letters', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu')
  })

  // A vowel sign is a combining mark, not a letter — dropping marks would leave
  // "সমসয", which is a different word, not a slug of the same one.
  it('keeps letters and their marks from non-Latin scripts', () => {
    expect(slugify('সমস্যা রিপোর্ট')).toBe('সমস্যা-রিপোর্ট')
    expect(slugify('مرحبا بالعالم')).toBe('مرحبا-بالعالم')
    expect(slugify('日本語のトピック')).toBe('日本語のトピック')
  })

  it('drops punctuation and emoji, which carry no letters or digits', () => {
    expect(slugify('Bug: it crashed! 🔥')).toBe('bug-it-crashed')
  })

  it('collapses runs of separators and trims the ends', () => {
    expect(slugify('  --Hello / World..  ')).toBe('hello-world')
  })

  it('returns empty for input with nothing sluggable in it', () => {
    expect(slugify('---')).toBe('')
    expect(slugify('!!!')).toBe('')
    expect(slugify('')).toBe('')
  })

  // What the field round-trips through on an edit: the stored slug is decoded
  // for display, and re-slugifying it must not erode it.
  it('is stable when re-applied to a slug it already produced', () => {
    for (const title of ['My First Topic', 'Café Déjà Vu', 'সমস্যা রিপোর্ট', 'مرحبا بالعالم']) {
      expect(slugify(slugify(title))).toBe(slugify(title))
    }
  })
})
