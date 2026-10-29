/**
 * Tag helpers, apart from the TagFilter control so the topic list and cards can
 * use them without loading the control: TagFilter is loaded on demand (see
 * topics.tsx), and importing these from its module would load it at once.
 */

/**
 * Selected tag slugs from a raw query-string value.
 *
 * The backend ORs a comma separated slug list (`tax_query` with `operator =>
 * 'IN'`), so that is the wire format. Blank segments and repeats are dropped so
 * `?tags=a,,a` and `?tags=a` describe the same filter — otherwise the topics
 * list would see two different filter keys and refetch for nothing.
 */
export const parseTagParam = (value: null | string): string[] => [
  ...new Set(
    (value ?? '')
      .split(',')
      .map(slug => slug.trim())
      .filter(Boolean)
  )
]

/**
 * How a tag is shown everywhere in the portal: a hash before the name as the
 * admin typed it. The hash says "this is a tag" where a type or status chip
 * beside it says nothing; the name is left alone so "API & Integrations" still
 * reads as words.
 */
export const tagLabel = (name: string) => `#${name}`
