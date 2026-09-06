import isPro from '../utils/isPro'
import { BitAppsPluginUtilUpdateNotice } from './BitappsPluginUtilUpdateNotice'
import LicenseInvalidAlert from './LicenseInvalidAlert.pro'
import PluginUpdateNotice from './PluginUpdateNotice'

export default function AllPluginEssentials({
  licensePath
}: {
  licensePath?: string
} = {}) {
  return (
    <div className="bc-mr-2">
      {isPro() && <LicenseInvalidAlert to={licensePath} />}
      <PluginUpdateNotice />
      <BitAppsPluginUtilUpdateNotice />
    </div>
  )
}
