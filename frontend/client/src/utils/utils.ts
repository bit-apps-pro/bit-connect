/**
 * Alias for document.querySelector
 * @param selector valid css selector
 * @returns dom element or null
 */

export const select = (selector: string): HTMLElement | null => global.document.querySelector(selector)

export const relativeTime = (postDateGmt: string): string => {
  const date = new Date(postDateGmt.replace(' ', 'T') + 'Z')
  const diffMs = Date.now() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 5) return `${diffWeeks}w ago`
  if (diffDays < 365) return `${diffMonths}mo ago`
  return `${diffYears}y ago`
}

type ComparisonOperator = '!=' | '!==' | '<' | '<=' | '==' | '===' | '>' | '>='

/**
 * Compares two version strings and returns the comparison result
 * @param version1 - First version string (e.g., "1.2.3")
 * @param version2 - Second version string (e.g., "1.2.4")
 * @param operator - Optional comparison operator
 * @returns If operator is provided, returns boolean based on the comparison.
 *          If no operator, returns 1 if version1 > version2, -1 if version1 < version2, 0 if equal
 */
export const versionCompare = (
  version1: string,
  version2: string,
  operator?: ComparisonOperator
): boolean | number => {
  const v1: number[] = version1.split('.').map(Number)
  const v2: number[] = version2.split('.').map(Number)

  const maxLength: number = Math.max(v1.length, v2.length)

  for (let i = 0; i < maxLength; i++) {
    const num1: number = v1[i] || 0
    const num2: number = v2[i] || 0

    if (num1 !== num2) {
      if (operator) {
        switch (operator) {
          case '!=': {
            return true
          } // If we found any difference, != is true
          case '!==': {
            return true
          } // If we found any difference, !== is true
          case '<': {
            return num1 < num2
          }
          case '<=': {
            return num1 < num2 || num1 === num2
          }
          case '==': {
            return false
          } // If we found any difference, == is false
          case '===': {
            return false
          } // If we found any difference, === is false
          case '>': {
            return num1 > num2
          }
          case '>=': {
            return num1 > num2 || num1 === num2
          }
          default: {
            return false
          }
        }
      }
      return num1 > num2 ? 1 : -1
    }
  }

  if (operator) {
    switch (operator) {
      case '!=':
      case '!==': {
        return false
      }
      case '<=':
      case '==':
      case '===':
      case '>=': {
        return true
      }
      default: {
        return false
      }
    }
  }

  return 0
}
