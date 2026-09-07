import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocalStorage } from 'react-use'

import { proxyRequest } from '../../../../admin/src/common/helpers/request'
import config from '../../../../admin/src/config/config'

interface CheckUpdateResponse {
  response: 'invalid' | 'valid'
}

/** Where a licence is re-checked. Written out plainly — see RecommendedPlugins. */
const licenseCheckUrl = 'https://wp-api.bitapps.pro/public/verify-site'

/**
 * Where the last check's answer is cached, per plugin.
 *
 * A plain, readable key. It used to be run through `btoa()`, which stores the
 * same string in a form nobody reading their own browser storage could make
 * sense of; there is nothing secret in it, and disguising it only made the
 * cache harder to clear and the code harder to trust.
 */
export const licenseValidityStorageKey = (proSlug: string | undefined) =>
  `${proSlug}-check-validity`

export default function useCheckLicenseValidity(forceRequest = false) {
  const [isNeedValidityCheck, setIsNeedValidityCheck] = useState(false)
  const [licenseValidity, setLicenseValidity] = useLocalStorage(
    licenseValidityStorageKey(config.PRO_SLUG),
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
