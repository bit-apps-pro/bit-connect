import { type FormInstance } from 'antd'
import { type ReactNode } from 'react'

/**
 * A full-width section of the topic form, below the description — for a field
 * that is part of the topic but is not a term, so it does not belong in the
 * row beside Topic Type.
 *
 * Nothing here: this plugin's topic is its title, its description, its terms
 * and its files, and the form already asks for each of them.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the contract a section is drawn against
export default function TopicFormExtras(_context: {
  form: FormInstance
  isEditMode: boolean
  topicId?: number
}): ReactNode {
  return
}
