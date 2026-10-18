import { listingLink } from '@pages/Layout/ui/Sidebar/listing-link'

import { type Topic } from '../shared/type'

/**
 * The list a newly created topic is shown in, to send its author to: the list
 * of the stage it was filed in — the sidebar's own link for that stage.
 */
export default function createdTopicListing(topic: Topic): string {
  return listingLink({ stage: topic.terms?.stages?.slug ?? '' })
}
