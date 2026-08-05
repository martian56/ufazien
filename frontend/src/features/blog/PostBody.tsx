import { useMemo } from 'react'
import { sanitizeHtml } from '../../utils/security'

interface PostBodyProps {
  html: string
  darkMode?: boolean
  /** Reader preferences from the blog's own controls. */
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  className?: string
}

/**
 * Renders a post body.
 *
 * One component for both the published page and the editor's preview, so the
 * two cannot drift. They were separate implementations, which is how a preview
 * stops resembling what readers get.
 *
 * The `prose` classes here only started working once @tailwindcss/typography
 * was actually installed; before that they were inert while preflight stripped
 * heading sizes, paragraph spacing and list markers.
 */
export default function PostBody({
  html,
  darkMode = false,
  fontFamily,
  fontSize,
  lineHeight,
  className = '',
}: PostBodyProps) {
  // Sanitising is not cheap and the body rarely changes, so do it once per
  // value rather than on every keystroke elsewhere on the page.
  const clean = useMemo(() => sanitizeHtml(html), [html])

  return (
    <div
      className={`blog-content prose prose-lg max-w-none ${darkMode ? 'dark prose-invert' : ''} ${className}`}
      style={{
        ...(fontFamily ? { fontFamily } : {}),
        ...(fontSize ? { fontSize: `${fontSize}px` } : {}),
        ...(lineHeight ? { lineHeight } : {}),
      }}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  )
}
