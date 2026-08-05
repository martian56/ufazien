import { describe, expect, it } from 'vitest'
import { fixMalformedHtml, processblogContent } from './contentProcessor'
import { sanitizeHtml } from './security'

describe('processblogContent', () => {
  it('returns an empty string for nothing', () => {
    expect(processblogContent('')).toBe('')
    expect(processblogContent(null)).toBe('')
  })

  /**
   * The inline-code pass claimed in a comment that it skipped code inside a
   * pre tag, and did not. Every fenced block was given inline pill styling, so
   * a code block rendered as one long pink line instead of a block.
   */
  it('does not give code inside a pre block the inline pill styling', () => {
    const out = processblogContent('<pre><code>const x = 1</code></pre>')
    const preSection = out.slice(out.indexOf('<pre'), out.indexOf('</pre>'))
    expect(preSection).not.toContain('px-2 py-1')
  })

  it('keeps the code block as a block', () => {
    const out = processblogContent('<pre><code>const x = 1</code></pre>')
    expect(out).toContain('<pre')
    expect(out).toContain('const x = 1')
  })

  it('still styles genuinely inline code', () => {
    const out = processblogContent('<p>Use <code>npm</code> for that</p>')
    expect(out).toContain('px-2 py-1')
  })

  it('handles a document with both inline and block code', () => {
    const out = processblogContent('<p>Run <code>ls</code></p><pre><code>ls -la</code></pre>')
    const preSection = out.slice(out.indexOf('<pre'), out.indexOf('</pre>'))
    expect(preSection).not.toContain('px-2 py-1')
    expect(out.slice(0, out.indexOf('<pre'))).toContain('px-2 py-1')
  })

  it('leaves no placeholder token behind', () => {
    const out = processblogContent('<pre><code>x</code></pre><pre><code>y</code></pre>')
    expect(out).not.toContain('ufz-pre-')
    expect(out).toContain('x')
    expect(out).toContain('y')
  })

  it('adds list markers', () => {
    const out = processblogContent('<ul><li>one</li></ul>')
    expect(out).toContain('list-disc')
  })

  it('styles blockquotes', () => {
    const out = processblogContent('<blockquote><p>quoted</p></blockquote>')
    expect(out).toContain('border-l-4')
  })

  /**
   * `<p([^>]*)>` also matches `<pre>`, because `<p` is its prefix and `re`
   * reads as attributes. fixMalformedHtml therefore treated every code block
   * as an unclosed paragraph and ate its opening tag:
   *   <pre><code>x</code></pre>  ->  <code>x</code></pre>
   */
  it('does not mistake pre for an unclosed paragraph', () => {
    expect(fixMalformedHtml('<pre><code>x</code></pre>')).toBe('<pre><code>x</code></pre>')
  })

  it('leaves other p-prefixed tags alone', () => {
    expect(fixMalformedHtml('<picture><img src="a.png"></picture>')).toContain('<picture>')
  })

  it('keeps the wrapper on an unclosed paragraph', () => {
    // It used to return bare "unclosed": the old step appended </p> right
    // after the opening tag, and the empty-paragraph cleanup then deleted the
    // pair. Closing the tag itself is DOMPurify's job at render time.
    expect(fixMalformedHtml('<p>unclosed')).toContain('<p>')
    expect(fixMalformedHtml('<p>unclosed')).toContain('unclosed')
  })

  it('produces closed markup once sanitised, which is what readers get', () => {
    expect(sanitizeHtml(processblogContent('<p>unclosed'))).toContain('</p>')
  })

  it('still handles a paragraph with attributes', () => {
    expect(fixMalformedHtml('<p class="lead">text</p>')).toContain('class="lead"')
  })
})
