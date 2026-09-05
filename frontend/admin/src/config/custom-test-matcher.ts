import { type MatcherState } from '@vitest/expect'
import _ from 'lodash'

type AnyObject = Record<string, unknown>

/**
 * Strips specified keys from an object or array of objects.
 *
 * @param obj The object or array from which to strip keys.
 * @param keys The array of keys to be stripped away.
 * @returns The object or array with specified keys omitted.
 * example:
 *   const result = stripKeys({ a: 1, b: 2 }, ['b']);
 *   console.log(result); // Outputs: { a: 1 }
 */

const stripKeys = (obj: AnyObject, keys: string[]) => {
  if (!_.isObject(obj)) return obj

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (_.isObject(item)) {
        return _.omit(item, keys)
      }
      return item
    })
  }

  return _.omit(obj, keys)
}

interface FunctionOperator {
  attrs: {
    id: string
    label: string
  }
}

/**
 * Strips specified keys from an object or array of objects and also strips function operators like ')' and ';'
 * @param obj The object or array from which to strip keys.
 * @param keys The array of keys to be stripped away.
 * @returns The object or array with specified keys omitted.
 */
const stripKeysWithFunctionOperators = (obj: AnyObject, keys: string[]) => {
  if (!_.isObject(obj)) return obj

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (_.isObject(item)) {
        if (
          (item as FunctionOperator)?.attrs?.label === ')' ||
          (item as FunctionOperator)?.attrs?.label === ';'
        ) {
          return _.omit(item, [...keys, 'attrs.id', 'attrs.label'])
        }
        return _.omit(item, keys)
      }
      return item
    })
  }

  return _.omit(obj, keys)
}

/**
 * Custom matcher to compare two objects ignoring specified keys.
 * @param received The object to compare.
 * @param expected The object to compare against.
 * @param ignoredKeys The keys to ignore while comparing.
 * @returns The result of the comparison.
 */
export const toEqualIgnoringKey = {
  toEqualIgnoringKey(
    this: MatcherState,
    received: AnyObject,
    expected: AnyObject,
    ignoredKeys: string[]
  ) {
    const receivedStripped = stripKeys(received, ignoredKeys || [])
    const expectedStripped = stripKeys(expected, ignoredKeys || [])

    const pass = this.equals(receivedStripped, expectedStripped)

    return {
      message: () =>
        pass
          ? `✅ Expected objects to NOT be equal ignoring key '${ignoredKeys}', but they were.`
          : `❌ Expected objects to be equal ignoring key '${ignoredKeys}',\n\n${this.currentTestName}\n${this.utils.diff(receivedStripped, expectedStripped)}\n\n`,
      pass
    }
  }
}

/**
 * Custom matcher to compare two objects ignoring specified keys and function operators.
 * @param received The object to compare.
 * @param expected The object to compare against.
 * @param ignoredKeys The keys to ignore while comparing.
 * @returns The result of the comparison.
 */
export const toEqualIgnoreKeyAndOperators = {
  toEqualIgnoreKeyAndOperators(
    this: MatcherState,
    received: AnyObject,
    expected: AnyObject,
    ignoredKeys: string[]
  ) {
    const receivedStripped = stripKeysWithFunctionOperators(received, ignoredKeys || [])
    const expectedStripped = stripKeysWithFunctionOperators(expected, ignoredKeys || [])

    const pass = this.equals(receivedStripped, expectedStripped)

    const message = pass
      ? `✅ Expected objects to NOT be equal ignoring key '${ignoredKeys}', but they were.`
      : `❌ Expected objects to be equal ignoring key '${ignoredKeys}',\n\n${this.currentTestName}\n${this.utils.diff(receivedStripped, expectedStripped)}\n\n`

    return {
      message: () => message,
      pass
    }
  }
}
