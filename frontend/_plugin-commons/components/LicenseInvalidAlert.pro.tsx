import { __ } from '../../admin/src/common/helpers/i18nWrap'
import { Alert } from 'antd'
import { LuMoveUpRight } from 'react-icons/lu'
import { Link } from 'react-router'

import useCheckLicenseValidity from './SupportPage/data/useCheckLicenseValidity'

export default function LicenseInvalidAlert({
  forceCheckLicense,
  to = '/support'
}: {
  forceCheckLicense?: boolean
  to?: string
}) {
  const { isLicenseValid } = useCheckLicenseValidity(forceCheckLicense)

  if (isLicenseValid) return

  return (
    <Alert
      action={
        <Link className="bc-mt-2" to={to}>
          {__('Manage license')}
          <LuMoveUpRight size={12} style={{ transform: 'translateY(-4px)' }} />
        </Link>
      }
      description={__(
        `Please update your license to ensure you receive the latest security updates and bug fixes. 
          Using an outdated or unofficial license may leave your system vulnerable to security breaches and data leaks. 
          We cannot take responsibility for issues arising from such scenarios. For your safety, always download from the official Bit Apps server.`
      )}
      message={__('Your license is invalid')}
      showIcon
      type="error"
    />
  )
}
