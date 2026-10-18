import { type FormInstance } from 'antd'
import { type ReactNode } from 'react'

/**
 * Where the topic is posted, asked first — above the visibility choice and the
 * title — as a `Form.Item` named by the parameter that carries the choice.
 *
 * None here: this plugin posts every topic to the forum as a whole, so there
 * is nowhere else to choose and the form asks nothing.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the contract a destination field is drawn against
export default function useDestinationField(_context: { form: FormInstance; isEditMode: boolean }): ReactNode {
  return
}
