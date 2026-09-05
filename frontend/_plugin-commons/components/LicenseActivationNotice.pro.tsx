import { __ } from '../../admin/src/common/helpers/i18nWrap'
import { Alert } from 'antd'

import useCheckLicenseValidity from './SupportPage/data/useCheckLicenseValidity'

export default function LicenseActivationNotice() {
  const { isLicenseValid } = useCheckLicenseValidity(true)

  if (isLicenseValid) return

  return (
    <Alert
      description={
        <>
          {__(
            `Please ensure that your product subscription is valid. If needed, try deactivating and reactivating your license.`
          )}
          <br />
          {__(
            `For further assistance, feel free to reach out to our live support or email us at support@bitapps.pro .`
          )}
        </>
      }
      message={__('Your license is invalid, try reactivate')}
      showIcon
      type="error"
    />
  )
}
