import { describe, expect, it } from 'vitest'
import wsService from './websocket'

/**
 * These guard the bug that kept community chat from ever connecting.
 *
 * getWebSocketUrl read `process.env.REACT_APP_WS_HOST`, which is Create React
 * App's convention. Vite does not define `process` in the browser, so merely
 * evaluating that expression threw "process is not defined" and every group
 * and private chat connection died before it opened a socket.
 */
describe('getWebSocketUrl', () => {
  it('builds a URL without touching process', () => {
    expect(() => wsService.getWebSocketUrl('community/groups/1/chat/')).not.toThrow()
  })

  it('produces a ws or wss URL under /ws/', () => {
    const url = wsService.getWebSocketUrl('community/groups/1/chat/')
    expect(url).toMatch(/^wss?:\/\//)
    expect(url).toContain('/ws/community/groups/1/chat/')
  })

  it('points at the API host rather than the page host', () => {
    // The app is served from the dev server but the API lives elsewhere, so a
    // socket aimed at window.location would reach the wrong process.
    const apiUrl = import.meta.env.VITE_API_URL
    if (!apiUrl) return

    const url = wsService.getWebSocketUrl('anything/')
    expect(url).toContain(new URL(apiUrl, 'http://localhost').host)
  })
})
