import { decodeEntities } from './decode-entities'

const isTerm = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && typeof (value as { taxonomy?: unknown }).taxonomy === 'string'

const decodeTerm = (term: Record<string, unknown>) => ({
  ...term,
  ...(typeof term.name === 'string' ? { name: decodeEntities(term.name) } : {}),
  ...(typeof term.description === 'string' ? { description: decodeEntities(term.description) } : {})
})

/**
 * Decodes the name and description of wp/v2 term objects, one or a list.
 *
 * WordPress returns them as stored, escaped: "API &amp; Integrations". Anything
 * that is not a term (it has no `taxonomy`) passes through unchanged, so this can
 * sit on every wp/v2 response.
 */
export function decodeTermFields<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map(item => (isTerm(item) ? decodeTerm(item) : item)) as T
  }

  return (isTerm(data) ? decodeTerm(data) : data) as T
}
