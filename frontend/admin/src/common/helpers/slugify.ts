/**
 * A preview of the slug WordPress will store for a name.
 *
 * `sanitize_title()` on the server is authoritative — this only has to agree
 * with it closely enough that the field does not visibly change on save. Names
 * with no Latin characters slugify to an empty string; the field is then left
 * blank and WordPress derives the slug itself.
 */
export default function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/[̀-ͯ]/g, '') // drop the accents NFKD split off
    .toLowerCase()
    .replaceAll(/[^a-z\d]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}
