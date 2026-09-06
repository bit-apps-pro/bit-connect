import { type ReactElement } from 'react'

type ArrayElement<ArrayType> = ArrayType extends readonly (infer ElementType)[] ? ElementType : never

interface LoopProps<StoreType, Key extends keyof StoreType> {
  /**
   * A function that returns the template content to render for each item
   * The function should return a template element with appropriate data-wp-* attributes
   * for the WordPress Interactivity API. The item type is inferred from the store and key.
   */
  children: (item: ArrayElement<NonNullable<StoreType[Key]>>, key: number | string) => ReactElement
  data: ArrayElement<NonNullable<StoreType[Key]>>[]
  /**
   * The key in the store to iterate over (e.g., 'fruits' if store has a 'fruits' property)
   */
  each: Key
  /**
   * The store object containing the data to iterate over
   */
  store: StoreType
}

/**
 * Loop component that works with WordPress Interactivity API
 * Creates a template with data-wp-each attribute for SSR and maps through data for client rendering
 */
export default function Loop<StoreType, Key extends keyof StoreType>({
  children,
  data,
  each,
  store
}: LoopProps<StoreType, Key>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataArray = store[each] as readonly any[]
  const isClient = typeof window !== 'undefined'

  if (isClient) {
    return <>{data?.map((item, index) => children(item, `state.${String(each)}.key.${index}`))}</>
  }

  const eachPath = `state.${String(each)}`
  const templateElement =
    dataArray && dataArray.length > 0
      ? children(dataArray[0], `state.${String(each)}.key.0`)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children({} as any, `state.${String(each)}.key.0`)
  return <template data-wp-each={eachPath}>{templateElement}</template>
}
