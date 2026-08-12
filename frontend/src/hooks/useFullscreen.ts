import { useCallback, useEffect, useState } from 'react'

interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

interface WebkitFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

function currentElement(): Element | null {
  if (typeof document === 'undefined') return null
  const doc = document as WebkitFullscreenDocument
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export function fullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as WebkitFullscreenDocument
  const element = document.documentElement as WebkitFullscreenElement
  return Boolean(
    (document.fullscreenEnabled && element.requestFullscreen) ||
      (element.webkitRequestFullscreen && doc.webkitExitFullscreen),
  )
}

export interface Fullscreen {
  isFullscreen: boolean
  supported: boolean
  toggle: () => void
  enter: () => void
  exit: () => void
}

export function useFullscreen(target?: HTMLElement | null): Fullscreen {
  const [isFullscreen, setIsFullscreen] = useState(() => currentElement() !== null)
  const [supported] = useState(fullscreenSupported)

  useEffect(() => {
    const sync = () => setIsFullscreen(currentElement() !== null)
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])

  const enter = useCallback(() => {
    const element = (target ?? document.documentElement) as WebkitFullscreenElement
    const request = element.requestFullscreen?.bind(element) ?? element.webkitRequestFullscreen?.bind(element)
    if (!request) return
    Promise.resolve(request()).catch(() => {})
  }, [target])

  const exit = useCallback(() => {
    const doc = document as WebkitFullscreenDocument
    const release = document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(document)
    if (!release) return
    Promise.resolve(release()).catch(() => {})
  }, [])

  const toggle = useCallback(() => {
    if (currentElement()) exit()
    else enter()
  }, [enter, exit])

  return { isFullscreen, supported, toggle, enter, exit }
}
