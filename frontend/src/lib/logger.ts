/**
 * Logging that stays quiet in production.
 *
 * There were 137 bare console.log calls, most of them emoji-prefixed traces of
 * every request and render. They shipped to users, drowned real errors, and
 * leaked request shapes into the console of a deployed app.
 *
 * Warnings and errors always go through, since those are worth seeing in a
 * production console. Debug output only appears in development.
 */

const isDev = import.meta.env.DEV

export const logger = {
  debug(...args: unknown[]): void {
    if (isDev) console.log(...args)
  },

  info(...args: unknown[]): void {
    if (isDev) console.info(...args)
  },

  warn(...args: unknown[]): void {
    console.warn(...args)
  },

  error(...args: unknown[]): void {
    console.error(...args)
  },
}
