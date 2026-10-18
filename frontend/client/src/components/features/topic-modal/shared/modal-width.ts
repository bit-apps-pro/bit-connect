/**
 * How wide the create and edit topic modals are.
 *
 * Wider than antd's default 520px: a topic is the longest thing the portal asks
 * anyone to write, and at 520px the description box held barely a sentence a
 * line, while a pasted screenshot or video filled it end to end. antd keeps a
 * modal inside the screen on its own, so a phone still gets the full width less
 * its margins.
 */
export const TOPIC_MODAL_WIDTH = 720

/**
 * The backdrop behind both topic modals: antd's dimming plus a light blur.
 * Dimmed alone, the topic list behind stayed sharp enough to read and pulled
 * the eye away from the post being written.
 */
export const TOPIC_MODAL_MASK = { backdropFilter: 'blur(4px)' } as const
