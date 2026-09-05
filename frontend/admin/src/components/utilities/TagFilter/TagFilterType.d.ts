interface TagList {
  active: boolean
  filter?: JSON
  id: number
  label: string
  pinned: boolean
}

interface TagsListType {
  className?: string
  onActive: (tagId: number) => void
  onAdd?: () => void
  onEdit?: (tagId: number) => void
  onFilter?: (tagId: number) => void
  onInactive: (tagId: number) => void
  onPin?: (tagId: number) => void
  onRemove?: (tagId: number) => void
  onUnpin?: (tagId: number) => void
  tagsList: TagList[]
}
