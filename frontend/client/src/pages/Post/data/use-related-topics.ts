import { type Topic } from '@features/topic-modal/shared/type'
import { useQuery } from '@tanstack/react-query'

import { fetchAllPostsApi } from '@/store/data/fetch-all-posts-api'
import { type PostsFilters } from '@/store/posts.type'

/** How many related topics to show once the current one is filtered out. */
const RELATED_LIMIT = 5

/**
 * Topics related to the one being viewed.
 *
 * There is no dedicated "related" endpoint, and none is needed: the topics
 * endpoint already filters by taxonomy, so the strongest signal the post
 * carries is reused. Tags are the most specific, so they win; department is the
 * fallback because every topic has one, and topic type is far too broad to be
 * a useful relation on its own.
 *
 * Returns nothing when the topic has neither — better an absent panel than one
 * full of unrelated posts.
 */
export default function useRelatedTopics(topic: Topic | undefined) {
  const tagSlug = topic?.terms?.tags?.[0]?.slug
  const departmentSlug = topic?.terms?.departments?.slug
  const filterKey: keyof PostsFilters = tagSlug ? 'tags' : 'departments'
  const filterValue = tagSlug ?? departmentSlug
  const currentId = topic?.ID

  const { data, isLoading } = useQuery({
    enabled: Boolean(filterValue && currentId),
    queryFn: () =>
      fetchAllPostsApi({
        // Fetch one extra: the current topic almost always matches its own
        // filter and is dropped below.
        per_page: RELATED_LIMIT + 1,
        ...(tagSlug ? { tags: tagSlug } : { departments: departmentSlug })
      }),
    queryKey: ['related-topics', filterKey, filterValue, currentId],
    select: page => page.topics.filter(t => t.ID !== currentId).slice(0, RELATED_LIMIT),
    // Related topics change rarely; avoid refetching while the reader scrolls.
    staleTime: 5 * 60 * 1000
  })

  return { isLoadingRelated: isLoading, relatedTopics: data ?? [] }
}
