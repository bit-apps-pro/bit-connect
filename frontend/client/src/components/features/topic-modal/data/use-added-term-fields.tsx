import { type FormInstance } from 'antd'
import { type ReactNode } from 'react'

/**
 * The topic form's fields for the taxonomies a plugin adds, drawn beside
 * Topic Type — one `Form.Item` each, named by the parameter that carries its
 * term, so the value reaches the server with the rest of the form.
 *
 * None here: this plugin files a topic under a type, a stage, a status and
 * tags, and the form already asks for the ones a member chooses. Returned as a
 * list rather than rendered, because the row lays its fields out by how many
 * there are.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the contract a plugin's fields are drawn against
export default function useAddedTermFields(_context: { form: FormInstance; isEditMode: boolean }): ReactNode[] {
  return []
}
