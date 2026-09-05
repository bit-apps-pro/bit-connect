import { create } from 'zustand'

interface TopicModal {
  closeEditModal: () => void
  editTopicId: number | undefined
  isCreateModalOpen: boolean
  isEditModalOpen: boolean
  openEditModal: (topicId: number) => void
  setCreateModalOpen: (isOpen: boolean) => void
  setEditModalOpen: (isOpen: boolean) => void
}

const useTopicModalStore = create<TopicModal>(set => ({
  closeEditModal: () => set({ editTopicId: undefined, isEditModalOpen: false }),
  editTopicId: undefined,
  isCreateModalOpen: false,
  isEditModalOpen: false,
  openEditModal: (topicId: number) => set({ editTopicId: topicId, isEditModalOpen: true }),
  setCreateModalOpen: (isOpen: boolean) => set({ isCreateModalOpen: isOpen }),
  setEditModalOpen: (isOpen: boolean) => set({ isEditModalOpen: isOpen })
}))

export default useTopicModalStore
