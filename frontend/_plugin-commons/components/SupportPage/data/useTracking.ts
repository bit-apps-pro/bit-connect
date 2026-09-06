import request from '../../../../admin/src/common/helpers/request'
import { useQuery } from '@tanstack/react-query'

interface Tracking {
  allowTracking: boolean
}

export default function useTracking() {
  const { data, isLoading } = useQuery<{ data: Tracking }, Error>({
    queryFn: () => request('pro_plugin-improvement', undefined, undefined, 'GET'),
    queryKey: ['tracking']
  })

  return {
    isTrackingLoading: isLoading,
    tracking: data?.data
  }
}
