/* eslint-disable no-restricted-imports */
/* eslint-disable unicorn/no-typeof-undefined */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { __ as i18n_, sprintf as i18nSprintf } from '@wordpress/i18n'

// declare let bitapp: any
declare let wp: any
// declare var bitapp: any

const __ = (text: string, domain = 'bit-connect'): string => {
  if (SERVER_VARIABLES?.translations?.[text]) {
    return SERVER_VARIABLES.translations[text]
  }

  if (typeof wp !== 'undefined' && !wp?.i18n) {
    return text
  }

  return i18n_(text, domain)
}

/**
 * Fills placeholders without wp.i18n: plain (`%s`) and positional (`%1$d`), and
 * `%%` as a literal percent sign. A placeholder with no value stays as it is.
 */
export const fallbackSprintf = (text: string, ...vars: any[]): string => {
  let next = 0

  return text.replaceAll(/%(?:(\d+)\$)?([%E-GXb-gosux])/g, (placeholder, position, type) => {
    if (type === '%') {
      return '%'
    }

    const value = vars[position ? Number(position) - 1 : next++]

    return value === undefined ? placeholder : String(value)
  })
}

const sprintf = (text: string, ...vars: any) => {
  // `typeof` first: `wp?.i18n` alone throws a ReferenceError on a page with no
  // `wp` global at all, which is every portal page — the portal loads no
  // WordPress scripts — and it took the header down with it.
  if (import.meta.env.MODE !== 'test' && (typeof wp === 'undefined' || !wp?.i18n)) {
    return fallbackSprintf(text, ...vars)
  }

  return i18nSprintf(text, ...vars)
}

export { __, sprintf }
