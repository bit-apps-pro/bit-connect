export interface PostsStore {
  error: string | undefined
  isVoting: boolean
  toggleVote: (postId: number) => Promise<void>
}

export interface PostsFilters {
  /** Term slugs of a taxonomy a plugin adds, under its parameter — see TopicTaxonomies.php. */
  [param: string]: number | string | undefined
  my_topics?: string
  page?: number
  per_page?: number
  search?: string
  sortBy?: string
  stages?: string
  statuses?: string
  tags?: string
  'topic-types'?: string
  /** A named list another plugin adds — see use-added-views. */
  view?: string
  visibility?: string
}
