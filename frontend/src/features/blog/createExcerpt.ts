/**
 * Plain-text preview of a post, for cards and listings.
 *
 * Shared by the listing page and the post card, which is why it does not live
 * in either of them.
 */

/**
 * Strip markup by letting the browser parse it, rather than by regex.
 *
 * Parsed into an inert document rather than assigned to an element's
 * innerHTML. A detached element still belongs to the live document, and a
 * browser may begin loading an `<img>` placed in one, which is enough to fire
 * an `onerror` handler. A document from `DOMParser` fetches nothing and runs
 * nothing, so only its text ever comes back out.
 */
export function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return ''
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  return parsed.body.textContent || ''
}

export function createExcerpt(content: string | null | undefined, maxLength = 150): string {
  const plainText = stripHtmlTags(content)
  if (plainText.length <= maxLength) return plainText
  // Trim before appending, so the ellipsis does not follow a space.
  return `${plainText.substring(0, maxLength).trim()}...`
}
