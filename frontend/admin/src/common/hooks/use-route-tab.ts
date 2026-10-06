import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'

/**
 * The open tab of a screen, kept in the address: `#/general/location`.
 *
 * A tab held in component state is gone on refresh, so a reload of the
 * Location tab landed on Branding, and a tab could not be linked to at all. The
 * route carries it instead, as an optional `:tab` segment after the screen —
 * the first tab stays at the bare screen address, so the links WordPress and
 * the onboarding already point at it keep working, and so the default view
 * has only one address.
 *
 * A tab the screen does not have falls back to the first, as a stale link
 * should, rather than showing an empty panel.
 *
 * @param base The screen's own address, as its route declares it: `/general`.
 * @param keys Every tab the screen has, the first of them the default.
 */
export default function useRouteTab<K extends string>(base: string, keys: readonly K[]) {
  const { tab } = useParams()
  const navigate = useNavigate()
  const fallback = keys[0]
  const activeTab = keys.find(key => key === tab) ?? fallback

  const setActiveTab = useCallback(
    (key: K | number | string) => {
      navigate(key === fallback ? base : `${base}/${key}`)
    },
    [base, fallback, navigate]
  )

  return { activeTab, setActiveTab }
}
