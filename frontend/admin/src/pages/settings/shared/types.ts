export interface TopicAccessSettings {
  comment: boolean
  commentUpvote: boolean
  /** Pro. The server reports this as false unless pro is installed and licensed. */
  privateTopic: boolean
  upvote: boolean
}

export interface CleanupSettings {
  deleteDataOnUninstall: boolean
}

export interface TopicFormFieldsSettings {
  requireDepartment: boolean
  requireTopicType: boolean
}

export interface ModerationSettings {
  /** How many pending reports take content out of public view. Minimum 1. */
  autoHideThreshold: number
}

export interface Settings {
  cleanup: CleanupSettings
  moderation: ModerationSettings
  topicAccess: TopicAccessSettings
  topicFormFields: TopicFormFieldsSettings
}

export interface SettingsFormData {
  cleanup: CleanupSettings
  moderation: ModerationSettings
  topicAccess: TopicAccessSettings
  topicFormFields: TopicFormFieldsSettings
}

// ---- Authentication Settings ------------------------------------------------

export type AuthMode = 'custom_url' | 'plugin_default'

export interface AuthLoginPageCustomization {
  banner: string
  description: string
  title: string
}

export interface RoleOption {
  label: string
  value: string
}

export interface AuthSettings {
  /** Read-only — assignable WP roles for registration, provided by server */
  availableRoles: RoleOption[]
  customLoginUrl: string
  customRegistrationUrl: string
  loginPageCustomization: AuthLoginPageCustomization
  /** Read-only — provided by server, not sent on update */
  loginPageUrl: string
  mode: AuthMode
  redirectAfterLogin: string
  redirectAfterLogout: string
  /** Read-only — provided by server, not sent on update */
  registrationPageUrl: string
  /** WP role assigned to users who register via the plugin form */
  registrationRole: string
  requireEmailVerification: boolean
}

export interface AuthSettingsFormData {
  customLoginUrl: string
  customRegistrationUrl: string
  loginPageCustomization: AuthLoginPageCustomization
  mode: AuthMode
  redirectAfterLogin: string
  redirectAfterLogout: string
  registrationRole: string
  requireEmailVerification: boolean
}
