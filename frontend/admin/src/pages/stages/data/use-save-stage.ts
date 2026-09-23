import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type Response } from '@common/helpers/request'
import { wpApi } from '@common/request/wp-api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContext } from 'react'

import { type Stage } from '../shared/types'

export interface ErrorResponse {
  errors: { message: string }
}

export interface StageRequestBody {
  description?: string
  meta: {
    bit_connect_icon_dark_id?: number
    bit_connect_icon_dark_url?: string
    bit_connect_icon_id?: number
    bit_connect_icon_url?: string
  }
  name: string
  slug?: string
}

export default function useSaveStage() {
  const queryClient = useQueryClient()
  const { messageApi } = useContext(NotifyContext)

  const { error, isError, isPending, mutateAsync } = useMutation<
    Response<Stage>,
    ErrorResponse,
    StageRequestBody
  >({
    mutationFn: stageData =>
      wpApi<StageRequestBody, Stage>('bit-connect-stages', {
        body: stageData,
        method: 'POST'
      }),
    mutationKey: ['stages', 'store'],
    onSuccess: () => {
      messageApi?.success(__('Stage created successfully'))
      queryClient.invalidateQueries({ queryKey: ['stages'] })
    }
  })

  return {
    error: error,
    isError: isError,
    isSavingStage: isPending,
    saveStage: mutateAsync
  }
}
