export interface TopicAccessSettings {
  comment: boolean
  commentUpvote: boolean
  /** Pro. The server reports the effective value, so this is already false
      unless pro is installed, licensed, and the admin switched it on. */
  privateTopic: boolean
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
