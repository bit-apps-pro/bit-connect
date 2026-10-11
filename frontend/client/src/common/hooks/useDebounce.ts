import debounce from 'lodash/debounce'
import { useEffect, useMemo, useRef } from 'react'

const useDebounce = <T extends unknown[], S>(callback: (...arguments_: T) => S, delay = 400) => {
  const reference = useRef(callback)

  useEffect(() => {
    reference.current = callback
  }, [callback])

  const debouncedCallback = useMemo(() => {
    // pass arguments to callback function
    const function_ = (...argument: T) => reference.current(...argument)

    return debounce(function_, delay)
  }, [delay])

  return debouncedCallback
}

export default useDebounce
