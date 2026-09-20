export interface TopicAccessSettings {
  comment: boolean
  commentUpvote: boolean
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
