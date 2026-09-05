import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

export interface RoleCapabilities {
  capabilities: Record<string, boolean>
  name: string
  slug: string
}

interface CapabilitySettingsResponse {
  allCapabilities: string[]
  capabilityLabels: Record<string, string>
  roles: RoleCapabilities[]
}

export default function useCapabilitySettings() {
  const { data, isError, isFetching } = useQuery<
    ResponseType<CapabilitySettingsResponse>,
    Error,
    CapabilitySettingsResponse
  >({
    queryFn: ({ signal }) =>
      request<never, CapabilitySettingsResponse>('capability-settings', { method: 'GET', signal }),
    queryKey: ['capability-settings'],
    retry: false,
    select: response => response?.data
  })

  return {
    capabilitySettings: data,
    isCapabilitySettingsError: isError,
    isCapabilitySettingsFetching: isFetching
  }
}
