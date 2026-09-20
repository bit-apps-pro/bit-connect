/**
 * Topic Access as this plugin knows it.
 *
 * No `commentUpvote`. The key exists in the stored option when the add-on is
 * installed — the server writes this screen's save over the stored group
 * rather than replacing it, so the add-on's switch survives — but it never
 * reaches this screen: AdminSettingsController::get() reports only the keys
 * this plugin implements. The add-on reads and writes its own.
 */
export interface TopicAccessSettings {
  comment: boolean
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

/**
 * Props for the moderation section.
 *
 * Declared here rather than in either sibling. Both editions render this
 * section, so the contract belongs to neither implementation — and the free
 * tree has to type-check without the pro one present, which it cannot do while
 * the dispatch imports its own props from a `.pro` file.
 */
export interface ModerationSectionProps {
  autoHideThreshold: number
  disabled?: boolean
  onChange: (autoHideThreshold: number) => void
}
