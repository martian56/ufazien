import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Component, type ReactNode } from 'react'

import { isClientIdUsable } from './SocialAuth'

describe('whether social sign-in is configured', () => {
  it('is not, when the environment says nothing', () => {
    // A fresh clone. `.env.example` declares VITE_GOOGLE_CLIENT_ID but the
    // setup instructions never said to copy it, so this is what a new
    // contributor actually has.
    expect(isClientIdUsable(undefined)).toBe(false)
  })

  it('is not, when the variable is set to nothing', () => {
    // `VITE_GOOGLE_CLIENT_ID=` in an env file reads as an empty string, not as
    // absent, and an empty client id fails exactly the same way.
    expect(isClientIdUsable('')).toBe(false)
    expect(isClientIdUsable('   ')).toBe(false)
  })

  it('is, when there is a client id', () => {
    expect(isClientIdUsable('123-abc.apps.googleusercontent.com')).toBe(true)
  })
})

/**
 * The boundary's job, stated against a component that throws on purpose.
 *
 * This mirrors `SocialAuthBoundary` rather than importing it, because it is
 * not exported and making it public only to test it would be worse. What is
 * asserted is the contract: a child that throws costs its own subtree and
 * nothing around it.
 */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function Explodes(): never {
  throw new Error('Google Identity Services did not like that client id')
}

describe('a social button that throws', () => {
  it('does not take the sign-in form with it', () => {
    // The failure this is here for: Google's script threw, React unmounted the
    // whole tree, and the page went blank — including the email and password
    // form, which has nothing to do with Google.
    const onError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <div>
        <label htmlFor="email">Email Address</label>
        <input id="email" name="email" />
        <Boundary>
          <Explodes />
        </Boundary>
      </div>,
    )

    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
    onError.mockRestore()
  })
})
