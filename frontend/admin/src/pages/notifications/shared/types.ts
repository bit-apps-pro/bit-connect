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
