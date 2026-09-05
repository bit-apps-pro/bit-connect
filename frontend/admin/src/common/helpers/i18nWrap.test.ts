import { afterEach, describe, expect, it } from 'vitest'

import { __, sprintf } from './i18nWrap'

/**
 * Seeds the translations the server injected into the page.
 *
 * Assigned rather than redefined: the test setup already installed the global,
 * and defineProperty on it a second time is refused.
 */
function withTranslations(translations: Record<string, string>) {
  const globals = window as unknown as { SERVER_VARIABLES: Record<string, unknown> }

  globals.SERVER_VARIABLES = { ...globals.SERVER_VARIABLES, translations }
}

afterEach(() => {
  withTranslations({})
})

// Every user-facing string in both apps goes through this, so the failure mode
// is not a wrong translation — it is a screen full of blanks, or an exception
// on a page where wp.i18n happens not to be loaded.
describe('__', () => {
  it('gives back the original text when nothing is translated', () => {
    expect(__('Save changes')).toBe('Save changes')
  })

  // The server injects the strings it already has, which is what makes the
  // first paint translated rather than English until wp.i18n catches up.
  it('prefers the translation the server injected', () => {
    withTranslations({ 'Save changes': 'পরিবর্তন সংরক্ষণ করুন' })

    expect(__('Save changes')).toBe('পরিবর্তন সংরক্ষণ করুন')
  })

  it('falls through for a string the server did not translate', () => {
    withTranslations({ 'Save changes': 'পরিবর্তন সংরক্ষণ করুন' })

    expect(__('Cancel')).toBe('Cancel')
  })

  it('never gives back an empty string for text that had some', () => {
    for (const text of ['Save', 'A longer sentence, with punctuation.', '%d items']) {
      expect(__(text)).not.toBe('')
    }
  })

  it('takes a text domain without changing the answer', () => {
    expect(__('Save changes', 'bit-connect')).toBe('Save changes')
  })
})

describe('sprintf', () => {
  it('substitutes a value into the placeholder', () => {
    expect(sprintf('%d reports', 3)).toBe('3 reports')
    expect(sprintf('Hidden by %s', 'Nadia')).toBe('Hidden by Nadia')
  })

  it('substitutes several values in order', () => {
    expect(sprintf('%s closed %d reports', 'Nadia', 2)).toBe('Nadia closed 2 reports')
  })

  // Translators reorder placeholders because word order differs by language,
  // and losing that turns a translated sentence into nonsense.
  it('honours the positional placeholders a translator reordered', () => {
    expect(sprintf('%2$d reports closed by %1$s', 'Nadia', 2)).toBe('2 reports closed by Nadia')
  })

  it('leaves a string with nothing to substitute alone', () => {
    expect(sprintf('No placeholders here')).toBe('No placeholders here')
  })
})
