import { type Topic } from '@features/topic-modal/shared/type'
import getRequest from '@utils/request/get'

interface TopicResponseData {
  data: { data: Topic[] }
}

/**
 * Fetch a post by its name/slug
 * @param postName - The post name/slug to fetch
 * @returns Promise<Topic> - The fetched post
 * @throws Error if post not found
 */
export async function fetchPostByNameApi(postName: string): Promise<Topic> {
  const response = await getRequest<TopicResponseData>('topics', {
    queryParam: { name: postName }
  })

  const topicsData = response.data?.data
  const topics = Array.isArray(topicsData) ? topicsData : []
  const topic: Topic | undefined = topics.length > 0 ? (topics[0] as Topic) : undefined

  if (!topic) {
    throw new Error('Post not found')
  }

  return topic
}
