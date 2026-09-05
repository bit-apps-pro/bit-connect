import { useMutation, useQuery } from '@tanstack/react-query'

import get from '@/utils/request/get'
import post from '@/utils/request/post'

import { type ReportTargetType } from '../state/use-report-modal-store'

interface ReportReason {
  label: string
  value: string
}

interface ReportPayload {
  details?: string
  reason: string
  target_id: number
  target_type: ReportTargetType
}

interface ReportResult {
  /** True when this report took the content out of public view. */
  hidden: boolean
  message: string
  pending: number
}

/**
 * The reasons on offer, read from the server.
 *
 * Kept server-side so the list, its wording and its order live with the enum
 * that validates them — a copy here would drift and start failing validation.
 */
export function useReportReasons(enabled: boolean) {
  const { data, isError, isFetching } = useQuery({
    // Only fetched once the modal is actually opened; nobody needs this on a
    // page they never report anything from.
    enabled,
    queryFn: ({ signal }) => get<ReportReason[]>('reports/reasons', { signal }),
    queryKey: ['report-reasons'],
    retry: false,
    select: response => response?.data,
    // The list changes only when the plugin does.
    staleTime: Number.POSITIVE_INFINITY
  })

  return { isReasonsError: isError, isReasonsFetching: isFetching, reasons: data ?? [] }
}

export default function useReportContent() {
  const { isPending, mutateAsync } = useMutation({
    mutationFn: (payload: ReportPayload) =>
      post<ReportPayload, ReportResult>('reports', { body: payload })
  })

  return { isReporting: isPending, report: mutateAsync }
}
