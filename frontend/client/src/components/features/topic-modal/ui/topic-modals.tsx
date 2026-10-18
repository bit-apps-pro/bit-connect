import { lazy, Suspense, useState } from 'react'

import useTopicModalStore from '../state/use-topic-modal-store'

// The topic form — antd's Form, Upload and validators, the editor shell — is a
// sizeable share of the portal's code, and most visitors never post. Each
// modal is fetched the first time it is asked for, then stays mounted so its
// close animation and form state behave exactly as before.
const TopicCreateModal = lazy(() => import('./topic-create-modal'))
const TopicEditModal = lazy(() => import('./topic-edit-modal'))

export default function TopicModals() {
  const { isCreateModalOpen, isEditModalOpen } = useTopicModalStore()
  const [createRequested, setCreateRequested] = useState(isCreateModalOpen)
  const [editRequested, setEditRequested] = useState(isEditModalOpen)

  if (isCreateModalOpen && !createRequested) setCreateRequested(true)
  if (isEditModalOpen && !editRequested) setEditRequested(true)

  return (
    <Suspense>
      {createRequested && <TopicCreateModal />}
      {editRequested && <TopicEditModal />}
    </Suspense>
  )
}
