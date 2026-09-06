import { proxyRequest } from '../../../../admin/src/common/helpers/request'
import config from '../../../../admin/src/config/config'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocalStorage } from 'react-use'

interface CheckUpdateResponse {
  response: 'invalid' | 'valid'
}

const licenseCheckUrl = `h_t_tps_:/_/wp_-api_.bit_apps_.pro_/pub_lic/veri_fy-si_te`.replaceAll('_', '')

export default function useCheckLicenseValidity(forceRequest = false) {
  const [isNeedValidityCheck, setIsNeedValidityCheck] = useState(false)
  const [licenseValidity, setLicenseValidity] = useLocalStorage(
    btoa(`${config.PRO_SLUG}-check-validity`),
    {
      checkedAt: 0,
      isValid: true
    }
  )

  const { data, isLoading: isCheckingValidity } = useQuery({
    enabled: config.IS_PRO && !!config.KEY && (isNeedValidityCheck || forceRequest),
    queryFn: () =>
      proxyRequest<CheckUpdateResponse>({
        bodyParams: {
          domain: config.SITE_BASE_URL,
          licenseKey: config.KEY ? { encryption: 'hmac_decrypt', value: config.KEY } : ''
        },
        method: 'POST',
        url: licenseCheckUrl
      }),
    queryKey: ['checkLicenseValidity'],
    refetchOnWindowFocus: false,
    retry: false,
    select: res => res?.data
  })

  // Update license validity status when data is fetched
  useEffect(() => {
    if (!data?.response) return

    setIsNeedValidityCheck(false)

    setLicenseValidity({ checkedAt: Date.now(), isValid: data.response === 'valid' })
  }, [data?.response, setLicenseValidity])

  // Check license validity every 24 hours
  useEffect(() => {
    if (!licenseValidity?.checkedAt) {
      setIsNeedValidityCheck(true)
      return
    }

    const timeDiff = Date.now() - licenseValidity.checkedAt
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

    if (timeDiff >= TWENTY_FOUR_HOURS) {
      setIsNeedValidityCheck(true)
    }
  }, [licenseValidity?.checkedAt])

  return {
    isCheckingValidity,
    isLicenseValid: config.IS_PRO ? licenseValidity?.isValid : true
  }
}
