import { useState } from 'react'

export default function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)

  const setCopiedAndReset = () => {
    setCopied(true)

    setTimeout(() => {
      setCopied(false)
    }, 2500)
  }

  const copy = (text: string) => {
    if (window.isSecureContext && navigator.clipboard) {
      // Confirmed only once the write resolves. Announcing it up front made
      // "Copied" a promise the page could not keep — a denied clipboard
      // permission rejects here, and the reader would paste the last thing they
      // copied somewhere else believing it was this link. The rejection also
      // needs catching either way, or it surfaces as an unhandled rejection.
      navigator.clipboard.writeText(text).then(setCopiedAndReset, error => {
        console.error('Unable to copy to clipboard', error)
      })

      return
    }

    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.append(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      setCopiedAndReset()
    } catch (error) {
      console.error('Unable to copy to clipboard', error)
    }
    textArea.remove()
  }

  return { copied, copy }
}
