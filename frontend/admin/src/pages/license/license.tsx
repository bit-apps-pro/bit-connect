import config from '@config/config'
import SupportPage from '@plugin-commons/components/SupportPage'

/**
 * License & Support.
 *
 * One screen for both editions, matching how the other Bit Apps plugins do it
 * (see Bit Social's `pages/Support/Support.tsx`): the shared commons component
 * carries About, License & Activation, the changelog, support links, community
 * card and recommended plugins, and picks up fixes made once upstream.
 *
 * A deliberate exception to the `.free`/`.pro` split rule in CLAUDE.md. The
 * commons `License` component already branches on `IS_PRO_EXIST` internally —
 * free installs get "Buy Pro Version", installs with the add-on get activation
 * — so splitting it here would mean maintaining a second copy of a screen the
 * commons already handles, and would drift from the sibling plugins. The cost
 * is that the free bundle carries the (inert) activation code, exactly as
 * Bit Social's free build does.
 *
 * It pairs with the commons LicenseController wired in pro/backend/hooks/ajax.php;
 * the action names on both sides have to match, so do not rename either half in
 * isolation. Activation goes through a popup to the Bit Apps subscription site,
 * which redirects back with `?licenseKey=` — there is deliberately no field to
 * paste a key into.
 */
export default function License() {
  return (
    <SupportPage
      // The cash-back offer is a Bit Flows promotion, not something Bit Connect
      // runs, so its card stays off here.
      isCashBackVisible={false}
      // Always on, unlike the other Bit Apps plugins, which gate this on the
      // pro plugin existing. Bit Connect reports from the *free* plugin
      // (Plugin::initWPTelemetry), so consent has to be reachable whether or
      // not pro is installed — hiding it would mean reporting with no way to
      // see that or stop it.
      isTelemetryVisible
      logoComponent={undefined}
      pluginSlug={config.PLUGIN_SLUG}
    />
  )
}
