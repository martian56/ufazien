/**
 * Copy text, with a fallback for when the async clipboard is unavailable.
 *
 * navigator.clipboard needs a secure context and a focused document, and
 * rejects otherwise. The share buttons treated a rejection as "do nothing",
 * so a failed copy looked identical to no click at all.
 *
 * Returns whether the text actually reached the clipboard, so callers can say
 * something true either way.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the older path below.
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    // Keep it out of view and out of the tab order, and avoid scrolling to it.
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}
