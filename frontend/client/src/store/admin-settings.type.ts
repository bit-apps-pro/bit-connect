export interface TopicAccessSettings {
  comment: boolean
  upvote: boolean
  /**
   * Whether replies can be upvoted. Optional because this plugin never sends
   * it — upvoting a reply ships in Bit Connect Pro, and the add-on adds the
   * key to this payload when it is installed.
   */
  commentUpvote?: boolean
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
