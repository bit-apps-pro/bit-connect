import { request } from '@common/request'
import { useQuery } from '@tanstack/react-query'

import type DashboardDataType from './FlowDashboardType'

export default function useFetchDashboardData() {
  const { data, isLoading } = useQuery({
    queryFn: ({ signal }) => request<never, DashboardDataType>('dashboard', { method: 'GET', signal }),
    queryKey: ['dashboard']
  })

  return {
    isLoading,
    monthlyActivity: data?.data?.monthlyActivity || [],
    recentTopics: data?.data?.recentTopics || [],
    stats: data?.data?.stats || { totalComments: 0, totalMembers: 0, totalTopics: 0, totalVotes: 0 },
    topTopics: data?.data?.topTopics || []
  }
}
