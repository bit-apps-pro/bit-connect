/**
 * Topic Access as the portal receives it.
 *
 * No `commentUpvote`: this plugin does not send one, because upvoting a reply
 * is the add-on's feature and the add-on tells the portal about its own. The
 * control is driven by use-comment-vote, not by a flag here.
 */
export interface TopicAccessSettings {
  comment: boolean
  upvote: boolean
}

export interface TopicFormFieldsSettings {
  requireDepartment: boolean
  requireTopicType: boolean
}

export interface AdminSettings {
  topicAccess: TopicAccessSettings
  topicFormFields: TopicFormFieldsSettings
}

export interface AdminSettingsStore {
  error: string | undefined
  fetchSettings: () => Promise<void>
  isLoading: boolean
  isUpdating: boolean
  setError: (error: string | undefined) => void
  setLoading: (isLoading: boolean) => void
  settings: AdminSettings
  updateSettings: (settings: AdminSettings) => Promise<void>
}
