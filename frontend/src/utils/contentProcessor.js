/**
 * Content Processor for Blog Posts
 * Fixes malformed HTML and improves content rendering
 */

/**
 * Fix malformed HTML content from rich text editor
 * @param {string} htmlContent - Raw HTML content from editor
 * @returns {string} - Fixed HTML content
 */
export const fixMalformedHtml = (htmlContent) => {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return ''
  }

  let content = htmlContent

  // Step 1 used to "fix" an unclosed paragraph by appending </p> immediately
  // after the opening tag. That produces an empty paragraph followed by loose
  // text, and step 7 then deletes the empty paragraph, so <p>unclosed came out
  // as bare "unclosed" with the wrapper gone. Removed: DOMPurify closes tags
  // when it sanitises, and step 5 below wraps any bare run of text.

  // Step 2: Fix nested block elements inside paragraphs
  // Move headings out of paragraphs
  content = content.replace(/<p(\s[^>]*)?>\s*(<h[1-6][^>]*>.*?<\/h[1-6]>)\s*<\/p>/g, '$2')
  content = content.replace(/<p(\s[^>]*)?>\s*(<h[1-6][^>]*>.*?)\s*<p(\s[^>]*)?>/g, '$2</h$1>')

  // Step 3: Fix multiple consecutive paragraph tags with same content
  content = content.replace(/(<p(?:\s[^>]*)?>)\s*(<p(?:\s[^>]*)?>)/g, '$1')
  content = content.replace(/(<\/p>)\s*(<\/p>)/g, '$1')

  // Step 4: Fix incomplete heading tags
  content = content.replace(/<h([1-6])([^>]*)>\s*<p(\s[^>]*)?>/g, '<h$1$2>')
  content = content.replace(/<p(\s[^>]*)?>\s*(<\/h[1-6]>)/g, '$2')

  // Step 5: Ensure proper paragraph structure
  // Split content by double line breaks and wrap in paragraphs if needed
  const parts = content.split(/\n\s*\n/)
  content = parts.map(part => {
    part = part.trim()
    if (!part) return ''
    
    // If it's already wrapped in a block element, keep it as is
    if (/^<(h[1-6]|div|blockquote|pre|ul|ol|table|hr|img)/i.test(part)) {
      return part
    }
    
    // If it's not wrapped in paragraph tags, wrap it
    if (!/^<p/i.test(part)) {
      return `<p>${part}</p>`
    }
    
    return part
  }).filter(Boolean).join('\n\n')

  // Step 6: Fix image alignment attributes
  // Handle images with data-alignment anywhere in the attributes
  content = content.replace(/<img([^>]*?)data-alignment="([^"]*)"([^>]*?)>/g, (match, before, alignment, after) => {
    const alignmentClass = alignment === 'left' ? 'text-left' : 
                          alignment === 'right' ? 'text-right' : 
                          'text-center'
    // Combine all attributes and remove data-alignment since we're using CSS classes
    const allAttributes = (before + after).trim()
    return `<div class="image-wrapper ${alignmentClass}"><img${allAttributes ? ' ' + allAttributes : ''} class="blog-image max-w-full h-auto rounded-lg shadow-sm mx-auto"></div>`
  })

  // Also handle images without data-alignment attribute
  content = content.replace(/<img(?![^>]*data-alignment)([^>]*)>/g, (match, attributes) => {
    return `<div class="image-wrapper text-center"><img${attributes} class="blog-image max-w-full h-auto rounded-lg shadow-sm mx-auto"></div>`
  })

  // Step 7: Clean up empty paragraphs and normalize spacing
  content = content.replace(/<p(\s[^>]*)?>\s*<\/p>/g, '') // Remove empty paragraphs
  content = content.replace(/\n{3,}/g, '\n\n') // Normalize line breaks
  content = content.replace(/\s+/g, ' ') // Normalize spaces
  content = content.trim()

  return content
}

/**
 * Process and enhance blog content for better rendering
 * @param {string} htmlContent - Raw HTML content
 * @returns {string} - Enhanced HTML content
 */
export const processblogContent = (htmlContent) => {
  if (!htmlContent) return ''

  // First fix malformed HTML
  let content = fixMalformedHtml(htmlContent)

  // Images are already processed in fixMalformedHtml, so we skip duplicate processing

  // Enhance code blocks
  content = content.replace(/<pre><code([^>]*)>(.*?)<\/code><\/pre>/gs, (match, attributes, code) => {
    return `<div class="code-block-wrapper my-6">
      <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
        <code${attributes}>${code}</code>
      </pre>
    </div>`
  })

  // Enhance inline code.
  // The comment here used to claim it skipped code inside a pre tag; it did
  // not, so every block of code was given inline pill styling and a fenced
  // block rendered as one long pink line. Park the pre blocks first.
  const preBlocks = []
  content = content.replace(/<pre[\s\S]*?<\/pre>/g, (block) => {
    preBlocks.push(block)
    return `[[ufz-pre-${preBlocks.length - 1}]]`
  })

  content = content.replace(/<code([^>]*)>(.*?)<\/code>/g, (match, attributes, code) => {
    return `<code class="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-sm font-mono"${attributes}>${code}</code>`
  })

  content = content.replace(/\[\[ufz-pre-(\d+)\]\]/g, (match, index) => preBlocks[Number(index)])

  // Enhance blockquotes
  content = content.replace(/<blockquote([^>]*)>(.*?)<\/blockquote>/gs, (match, attributes, quote) => {
    return `<blockquote class="border-l-4 border-blue-500 pl-6 py-2 my-6 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg"${attributes}>
      <div class="text-gray-700 dark:text-gray-300 italic">${quote}</div>
    </blockquote>`
  })

  // Enhance lists
  content = content.replace(/<ul([^>]*)>/g, '<ul class="list-disc list-inside my-4 space-y-2 pl-4"$1>')
  content = content.replace(/<ol([^>]*)>/g, '<ol class="list-decimal list-inside my-4 space-y-2 pl-4"$1>')
  content = content.replace(/<li([^>]*)>/g, '<li$1>')

  // Enhance tables
  content = content.replace(/<table([^>]*)>/g, '<div class="table-wrapper overflow-x-auto my-6"><table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg"$1>')
  content = content.replace(/<\/table>/g, '</table></div>')
  content = content.replace(/<th([^>]*)>/g, '<th class="px-6 py-3 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"$1>')
  content = content.replace(/<td([^>]*)>/g, '<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700"$1>')

  // Add horizontal rule styling
  content = content.replace(/<hr([^>]*)>/g, '<hr class="my-8 border-t-2 border-gray-200 dark:border-gray-700"$1>')

  return content
}

/**
 * Extract plain text from HTML for read time calculation
 * @param {string} htmlContent - HTML content
 * @returns {string} - Plain text content
 */
export const extractPlainText = (htmlContent) => {
  if (!htmlContent) return ''
  
  // Remove HTML tags and decode entities
  return htmlContent
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Decode ampersands
    .replace(/&lt;/g, '<') // Decode less than
    .replace(/&gt;/g, '>') // Decode greater than
    .replace(/&quot;/g, '"') // Decode quotes
    .replace(/&#x27;/g, "'") // Decode apostrophes
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
}

/**
 * Calculate estimated reading time
 * @param {string} content - Plain text or HTML content
 * @param {number} wordsPerMinute - Average reading speed (default: 200)
 * @returns {number} - Estimated reading time in minutes
 */
export const calculateReadTime = (content, wordsPerMinute = 200) => {
  if (!content) return 0
  
  const plainText = typeof content === 'string' && content.includes('<') 
    ? extractPlainText(content) 
    : content
    
  const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length
  const readTime = Math.ceil(wordCount / wordsPerMinute)
  
  return Math.max(1, readTime) // Minimum 1 minute
}
