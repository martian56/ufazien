/**
 * Plain-text preview of a post, for cards and listings.
 *
 * Shared by the listing page and the post card, which is why it does not live
 * in either of them.
 */

/**
 * Strip markup by letting the browser parse it, rather than by regex.
 *
 * The element is never attached to the document, so scripts and inline
 * handlers in the HTML do not run: only its text is read back out.
 */
export function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return ''
  const holder = document.createElement('div')
  holder.innerHTML = html
  return holder.textContent || ''
}

export function createExcerpt(content: string | null | undefined, maxLength = 150): string {
  const plainText = stripHtmlTags(content)
  if (plainText.length <= maxLength) return plainText
  // Trim before appending, so the ellipsis does not follow a space.
  return `${plainText.substring(0, maxLength).trim()}...`
}
