import { __, sprintf } from '@common/helpers/i18nWrap'
import { decodeSlug, wasSlugTaken } from '@utils/slug'

/**
 * What to tell the author when the slug they chose was already taken.
 *
 * The save never fails over a clash — WordPress appends a `-2` — so this is
 * the only moment the author finds out their topic is not at the URL they
 * typed. The form warns earlier where it can, but that check reserves nothing:
 * two authors can both be told a slug is free and the second still gets the
 * suffix. This runs on the server's answer, so it is never wrong.
 *
 * Returns undefined when there is nothing to disclose, which is the ordinary
 * case — hence a `description` hung off the existing success notification
 * rather than a second toast fired at everybody.
 */
export const slugDisclosure = (requested?: string, stored?: string): string | undefined => {
  if (!wasSlugTaken(requested ?? '', stored ?? '')) return undefined

  return sprintf(
    // translators: %s is the URL slug the topic ended up with.
    __('The link you chose was already taken, so this topic is at /%s'),
    decodeSlug(stored ?? '')
  )
}
