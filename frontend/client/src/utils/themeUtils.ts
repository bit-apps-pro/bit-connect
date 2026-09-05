/**
 * Create a template element with id 'antd-style' and insert it
 * into the head of the document. where antd styles will be injected.
 *
 * @returns template element with id
 */
export function createAntDesignStyleContainer() {
  const template = globalThis.document?.createElement('template') ?? {}
  template.id = 'antd-style'
  globalThis.document?.head?.insertBefore(template, globalThis.document?.head?.firstChild)
  return template
}
