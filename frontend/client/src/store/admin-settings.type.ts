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

/** How the topic form treats one of its optional fields — see TopicFieldMode.php. */
export type TopicFieldMode = 'hidden' | 'optional' | 'required'

export interface TopicFormFieldsSettings {
  department: TopicFieldMode
  topicType: TopicFieldMode
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
