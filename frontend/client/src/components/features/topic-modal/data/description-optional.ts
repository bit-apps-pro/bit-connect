import { type FormInstance } from 'antd'

/**
 * Whether the topic being written may be posted with an empty description.
 *
 * Asked when the form is checked rather than when it is drawn, so the answer
 * can depend on what the rest of the form holds by then.
 *
 * Never, here: in this plugin the description — its words, or a picture or a
 * video in their place — is what a topic says.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the contract an answer is given against
export default function descriptionOptional(_form: FormInstance): boolean {
  return false
}
