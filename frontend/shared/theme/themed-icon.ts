/**
 * Term-icon metadata as the REST API returns it. `icon_url` is the base icon
 * and the only one most terms have; `icon_dark_url` is an optional override an
 * admin uploads when the base artwork is too dark to read on a dark surface.
 *
 * Both are `string | undefined` in practice but arrive as `''` from WordPress
 * when the meta was never set — the REST default for a registered string meta —
 * so every check here has to treat empty as absent, not as a value.
 */
export interface ThemedIconMeta {
  icon_dark_id?: number
  icon_dark_url?: string
  icon_id?: number
  icon_url?: string
}

/**
 * The icon to render for the current theme.
 *
 * Dark falls back to the light icon, never the reverse: `icon_url` is the base
 * that every term has, and `icon_dark_url` is an opt-in override. A term with
 * only a light icon therefore looks exactly as it did before the dark slot
 * existed, in both themes.
 *
 * Returns `undefined` when the term has no icon at all, so callers can render
 * nothing rather than an empty `<img>`.
 */
export function pickThemedIcon(meta: ThemedIconMeta | undefined, isDark: boolean) {
  const light = meta?.icon_url || undefined

  if (!isDark) return light

  return meta?.icon_dark_url || light
}
