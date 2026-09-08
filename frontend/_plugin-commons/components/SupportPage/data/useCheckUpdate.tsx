import queryRequest from '../../../../admin/src/common/helpers/request'
import config from '../../../../admin/src/config/config'
import { useQuery } from '@tanstack/react-query'

interface CheckUpdateResponse {
  latest_version: string
}

export default function useCheckUpdate() {
  const { data, isLoading: isCheckingUpdates } = useQuery({
    enabled: config.IS_PRO_EXIST,
    queryFn: () =>
      queryRequest<CheckUpdateResponse>('pro_plugin/update-check', undefined, undefined, 'GET'),
    queryKey: ['update'],
    select: res => res.data
  })

  return {
    isCheckingUpdates,
    latestAvailableVersion: data?.latest_version || '0.0.0'
  }
}
