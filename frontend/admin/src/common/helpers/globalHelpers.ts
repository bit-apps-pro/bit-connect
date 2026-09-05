/* eslint-disable @typescript-eslint/no-explicit-any */

import { type ClassValue, clsx } from 'clsx'
import merge, { type Options } from 'deepmerge'
import { twMerge } from 'tailwind-merge'

// keyPath is a path array (['a','b','c']) — the loop below indexes it to walk
// and create intermediate objects. Typed `string` it still compiled, but only
// because indexing a string yields characters.
export const assign = (object: any, keyPath: string[], value: any) => {
  const lastKeyIndex = keyPath.length - 1

  for (let index = 0; index < lastKeyIndex; ++index) {
    const key = keyPath[index]
    if (!(key in object)) {
      object[key] = {} // eslint-disable-line no-param-reassign
    }
    object = object[key] // eslint-disable-line no-param-reassign
  }
  object[keyPath[lastKeyIndex]] = value // eslint-disable-line no-param-reassign
  return value
}

const forEach = (array: any[], iteratee: any) => {
  let index = -1
  const { length } = array

  while (++index < length) {
    iteratee(array[index], index)
  }
  return array
}

export const deepCopy = (target: any, map = new WeakMap()) => {
  if (typeof target !== 'object' || target === null) {
    return target
  }

  const isArray = Array.isArray(target)
  const cloneTarget: any = isArray ? [] : {}

  if (map.get(target)) {
    return map.get(target)
  }
  map.set(target, cloneTarget)

  if (isArray) {
    forEach(target, (value: any, index: number) => {
      cloneTarget[index] = deepCopy(value, map)
    })
  } else {
    forEach(Object.keys(target), (key: string) => {
      cloneTarget[key] = deepCopy(target[key], map)
    })
  }
  return cloneTarget
}

export const sortArrOfObj = (data: any, sortLabel: string) =>
  data.sort((a: any, b: any) => {
    if (a?.[sortLabel]?.toLowerCase() < b?.[sortLabel]?.toLowerCase()) return -1
    if (a?.[sortLabel]?.toLowerCase() > b?.[sortLabel]?.toLowerCase()) return 1
    return 0
  })

// eslint-disable-next-line unicorn/prefer-code-point, unicorn/prefer-spread
const textToChars = (text: string) => text.split('').map(c => c.charCodeAt(0))

const byteHex = (n: number) => {
  const string_ = `0${Number(n).toString(16)}`
  return string_.slice(Math.max(0, string_.length - 2))
}

const cipher = (salt: string) => {
  const applySaltToChar = (code: any) => textToChars(salt).reduce((a: number, b: number) => a ^ b, code)
  // eslint-disable-next-line newline-per-chained-call
  return (text: string) => text?.split('')?.map(textToChars).map(applySaltToChar).map(byteHex).join('')
}

const decipher = (salt: string) => {
  const applySaltToChar = (code: any) => textToChars(salt).reduce((a, b) => a ^ b, code)
  return (encoded: string) =>
    encoded
      ?.match(/.{1,2}/g)
      ?.map(hex => Number.parseInt(hex, 16))
      .map(applySaltToChar)
      // eslint-disable-next-line unicorn/prefer-code-point
      .map(charCode => String.fromCharCode(charCode))
      .join('')
}

export const bitCipher = cipher('btcd')
export const bitDecipher = decipher('btcd')

export const checkValidEmail = (email: string) => {
  if (/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    return true
  }
  return false
}

export const lighten = (color: string | undefined, percentage: number): string => {
  if (!color) return 'transparent'

  const newColor = color.replace('#', '')
  const r = Number.parseInt(newColor.slice(0, 2), 16)
  const g = Number.parseInt(newColor.slice(2, 4), 16)
  const b = Number.parseInt(newColor.slice(4, 6), 16)

  const lightenPercentage = percentage / 100
  const newR = Math.round(r + (255 - r) * lightenPercentage)
  const newG = Math.round(g + (255 - g) * lightenPercentage)
  const newB = Math.round(b + (255 - b) * lightenPercentage)

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB
    .toString(16)
    .padStart(2, '0')}`
}

/**
 * Check if two objects are equal
 *
 * @param obj1 First Object
 * @param obj2 Second Object
 * @returns Boolean
 */
export const isObjectEqual = <T, J>(object1: T, object2: J) =>
  JSON.stringify(object1) === JSON.stringify(object2)

type AllDataType = boolean | null | number | string | undefined
interface IfCondition<T> {
  else: (falseValue: T) => IfCondition<T>
  elseIf: (newCondition: AllDataType) => IfCondition<T>
  end: () => T
  then: (trueValue: T) => IfCondition<T>
}

export function _if<T>(condition: AllDataType): IfCondition<T> {
  let result: T
  let currentCondition = condition
  let finalConditionMet = false

  const chain: IfCondition<T> = {
    else: function (falseValue: T) {
      if (!finalConditionMet) {
        result = falseValue
        finalConditionMet = true
      }
      return chain
    },
    elseIf: function (newCondition: AllDataType) {
      if (!finalConditionMet) {
        currentCondition = Boolean(newCondition)
      }
      return chain
    },
    end: function () {
      return result!
    },
    // eslint-disable-next-line unicorn/no-thenable
    then: function (trueValue: T) {
      if (currentCondition && !finalConditionMet) {
        result = trueValue
        finalConditionMet = true
      }
      return chain
    }
  }

  return chain
}

/**
 * Combines multiple class names or class condition objects into a single string, merging them using Tailwind CSS utility classes.
 * @param {...ClassValue[]} inputs - Class names, arrays of class names, or objects representing conditional classes to be combined.
 * @returns {string} - Combined class names as a single string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 *
 * array combine merge function for deepmerge
 */
// NonNullable: `arrayMerge` is optional on `Options`, so the bare indexed type
// carries `| undefined` and every caller has to null-check a function that is
// always defined.
const combineMerge: NonNullable<Options['arrayMerge']> = (target, source, options) => {
  const destination = [...target]

  source.forEach((item, index) => {
    if (destination[index] === undefined) {
      destination[index] = options?.cloneUnlessOtherwiseSpecified(item, options)
    } else if (options?.isMergeableObject(item)) {
      destination[index] = merge(target[index], item, options)
    } else if (!target.includes(item)) {
      destination.push(item)
    }
  })
  return destination
}

type DeepmergeType = <T1, T2 = T1>(x: Partial<T1>, y: Partial<T2>, options?: Options) => T1 & T2

export const deepmerge: DeepmergeType = (x, y, options) => {
  return merge(x, y, { arrayMerge: combineMerge, ...options })
}
