/** One notification type's forum-wide row. */
export interface NotificationTypeSettings {
  email: boolean
  inapp: boolean
  /**
   * A cap, not a default. With this off the admin's answer stands whatever the
   * member has stored, including choices made before the lock went on.
   */
  userMayOverride: boolean
}

export interface NotificationSettingsData {
  defaultFrequency: string
  /** Site-local hour a digest goes out. */
  digestHour: number
  /** Master switch. Off means nothing is written and nothing is sent. */
  enabled: boolean
  fromEmail: string
  fromName: string
  /** Intro line on a digest, which covers several events at once. */
  mailDigestIntro: string
  /** Sign-off above the unsubscribe pointer. */
  mailFooter: string
  /** Greeting line. Plain text with {tokens}; see `placeholders`. */
  mailGreeting: string
  /** Intro line on an instant email. */
  mailIntro: string
  /** Days a *read* notification is kept. Unread rows are never pruned by age. */
  retentionDays: number
  types: Record<string, NotificationTypeSettings>
}

/** The four editable lines, keyed so the form can render them from one list. */
// fallow-ignore-next-line unused-export value exists only to derive MailTemplateKey
export const MAIL_TEMPLATE_KEYS = ['mailGreeting', 'mailIntro', 'mailDigestIntro', 'mailFooter'] as const

export type MailTemplateKey = (typeof MAIL_TEMPLATE_KEYS)[number]

/** What each type is, sent by the server so the screen keeps no copy of the enum. */
export interface NotificationTypeInfo {
  description: string
  label: string
  /** The forum sends this whatever anyone says; the in-app column is locked. */
  mandatoryInApp: boolean
  /** Never reaches an ordinary member, so the override column means nothing. */
  moderatorOnly: boolean
  type: string
}

export interface NotificationSettingsPayload {
  catalog: NotificationTypeInfo[]
  /** Where mail will appear to come from, with the fallbacks already applied. */
  effectiveSender: { email: string; name: string }
  frequencies: string[]
  /** token => what it becomes, described by the server so the help cannot drift. */
  placeholders: Record<string, string>
  settings: NotificationSettingsData
}

/** Patches one top-level field of the settings form. */
export type SetNotificationField = <K extends keyof NotificationSettingsData>(
  key: K,
  value: NotificationSettingsData[K]
) => void

/**
 * Props for the two email sections.
 *
 * Declared here rather than in either sibling. Both editions render these
 * sections, so the contract belongs to neither implementation — and the free
 * tree has to type-check without the pro one present, which it cannot do while
 * a `.free` file imports its own props from a `.pro` file.
 */
export interface EmailDeliverySectionProps {
  enabled: boolean
  form: NotificationSettingsData
  isSendingTest: boolean
  payload: NotificationSettingsPayload
  sendTestEmail: () => Promise<unknown>
  set: SetNotificationField
}

export interface EmailWordingSectionProps {
  enabled: boolean
  form: NotificationSettingsData
  payload: NotificationSettingsPayload
  set: SetNotificationField
}
