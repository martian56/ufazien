import { useCallback, useEffect, useRef, useState } from 'react'
import { blogApi, type BlogPost, type BlogPostInput } from '../../lib/api/endpoints/blog'
import { errorMessage } from '../../lib/api/errors'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const AUTOSAVE_DELAY_MS = 2000

/**
 * A post being written, saved to the server rather than to localStorage.
 *
 * Drafts used to be one JSON blob under the key "blog-draft": a single draft,
 * overwritten by the next one, never sent anywhere, and gone if you opened the
 * site on another device or cleared your browser.
 *
 * The first save creates the post unpublished, so it has an id and can be
 * resumed. Later saves patch it. Publishing flips is_published, which is when
 * the server stamps published_at.
 */
export function useDraft(existingId?: string | number | null) {
  const [postId, setPostId] = useState<number | string | null>(existingId ?? null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPublished, setIsPublished] = useState(false)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards against two saves racing when a keystroke lands mid-request, which
  // would otherwise create two posts from one draft.
  const inFlight = useRef(false)

  useEffect(() => {
    if (existingId) setPostId(existingId)
  }, [existingId])

  const save = useCallback(
    async (input: BlogPostInput): Promise<BlogPost | null> => {
      if (!input.title?.trim() && !input.content?.trim()) return null
      if (inFlight.current) return null

      inFlight.current = true
      setSaveState('saving')
      setError(null)

      try {
        const payload: BlogPostInput = {
          ...input,
          // A draft stays unpublished until you say otherwise.
          is_published: input.is_published ?? false,
        }

        const saved = postId
          ? await blogApi.update(postId, payload)
          : await blogApi.create({ ...payload, title: payload.title || 'Untitled draft' })

        setPostId(saved.id)
        setIsPublished(saved.is_published)
        setLastSaved(new Date())
        setSaveState('saved')
        return saved
      } catch (err) {
        setError(errorMessage(err, 'Could not save your draft'))
        setSaveState('error')
        return null
      } finally {
        inFlight.current = false
      }
    },
    [postId],
  )

  /** Debounced save, for use while typing. */
  const scheduleSave = useCallback(
    (input: BlogPostInput) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => save(input), AUTOSAVE_DELAY_MS)
    },
    [save],
  )

  const publish = useCallback(
    async (input: BlogPostInput) => {
      const saved = await save({ ...input, is_published: true })
      if (saved) setIsPublished(true)
      return saved
    },
    [save],
  )

  const unpublish = useCallback(async () => {
    if (!postId) return null
    const updated = await blogApi.unpublish(postId)
    setIsPublished(false)
    return updated
  }, [postId])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return { postId, saveState, lastSaved, error, isPublished, save, scheduleSave, publish, unpublish }
}
