import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type Stage } from '../shared/types'
import { type ErrorResponse, type StageRequestBody } from './use-save-stage'

interface UpdateStageData extends StageRequestBody {
  id: number
}

export default function useUpdateStage() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<Stage>,
    ErrorResponse,
    UpdateStageData
  >({
    mutationFn: stageData =>
      wpApi<UpdateStageData, Stage>(`bit-connect-stages/${stageData.id}`, {
        body: stageData,
        method: 'PUT'
      }),
    mutationKey: ['stages', 'update'],
    onError: () => {
      messageApi?.error(__('Failed to update stage'))
    },
    onSuccess: () => {
      messageApi?.success(__('Stage updated successfully'))
      queryClient.invalidateQueries({ queryKey: ['stages'] })
    }
  })

  return {
    error: error,
    isError: isError,
    isUpdatingStage: isPending,
    updateStage: mutateAsync
  }
}
