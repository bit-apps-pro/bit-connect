import queryRequest from '@common/helpers/request'
import { useQuery } from '@tanstack/react-query'

/** One forum capability and whether this member has it. */
export interface UserPermission {
  allowed: boolean
  group: string
  key: string
  label: string
}

interface PermissionsResponse {
  permissions: UserPermission[]
}

/**
 * What a member is allowed to do on the portal.
 *
 * Owner/moderator-only server-side, so `enabled` should be false for anyone
 * else — a request that slips through is rejected rather than served, and there
 * is no point firing one that will 403.
 */
export default function useUserPermissions(
  userId: number | string | undefined,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const id = Number(userId)
  const isValidUser = Number.isFinite(id) && id > 0

  const { data, isLoading } = useQuery({
    enabled: enabled && isValidUser,
    queryFn: async ({ signal }) =>
      queryRequest<PermissionsResponse>(`users/${id}/permissions`, {}, undefined, 'GET', { signal }),
    queryKey: ['user-permissions', id],
    retry: false,
    select: res => res?.data?.permissions ?? [],
    staleTime: 5 * 60 * 1000
  })

  return { isLoadingPermissions: isLoading, permissions: data ?? [] }
}
