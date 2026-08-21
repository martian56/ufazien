import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createRef } from 'react'

import TouchControls, { createTouchState, EMOTE_PRESS_MS, type TouchState, type TouchContext } from './TouchControls'

const idle: TouchContext = {
  insideBuilding: null,
  canInteract: false,
  canSit: false,
  seated: false,
  canGrab: false,
  holding: false,
  leaning: false,
}

function mount(context: Partial<TouchContext> = {}) {
  const stateRef = createRef<TouchState>() as { current: TouchState }
  stateRef.current = createTouchState()
  render(<TouchControls stateRef={stateRef} context={{ ...idle, ...context }} />)
  return stateRef
}

/**
 * What is on screen.
 *
 * A phone has no room for every control the campus has, so a button appears
 * where it does something and the rest live behind one.
 */
describe('the controls a thumb is offered', () => {
  it('shows only the two that always apply when there is nothing to do', () => {
    mount()
    expect(screen.getByRole('button', { name: /jump/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /emotes and more/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^sit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pick up/i })).not.toBeInTheDocument()
  })

  it('offers the chair only when there is one', () => {
    mount({ canSit: true })
    expect(screen.getByRole('button', { name: /^sit/i })).toBeInTheDocument()
  })

  it('says Stand once you are in it', () => {
    mount({ canSit: true, seated: true })
    expect(screen.getByRole('button', { name: /^stand/i })).toBeInTheDocument()
  })

  it('offers the throw only while something is in your hands', () => {
    mount({ canGrab: true, holding: true })
    expect(screen.getByRole('button', { name: /throw/i })).toBeInTheDocument()
  })

  it('keeps the emotes shut until they are asked for', () => {
    mount()
    // The whole point of a menu: a phone screen that is the campus, not buttons.
    expect(screen.queryByRole('button', { name: /^wave$/i })).not.toBeInTheDocument()
    act(() => {
      screen.getByRole('button', { name: /emotes and more/i }).click()
    })
    expect(screen.getByRole('button', { name: /^wave$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^clap$/i })).toBeInTheDocument()
  })

  it('offers the light switch only indoors', () => {
    mount()
    act(() => {
      screen.getByRole('button', { name: /emotes and more/i }).click()
    })
    expect(screen.queryByRole('button', { name: /lights/i })).not.toBeInTheDocument()

    mount({ insideBuilding: { name: 'Library' } })
    act(() => {
      screen.getAllByRole('button', { name: /emotes and more/i })[1].click()
    })
    expect(screen.getByRole('button', { name: /lights/i })).toBeInTheDocument()
  })
})

/**
 * Press and release.
 *
 * Every controller in the campus is edge-triggered: it acts on the frame a
 * control goes down. The door button set its flag and never cleared it, so it
 * read as held for ever — you could enter a building once and the button was
 * dead for the rest of the session.
 */
describe('holding a button down', () => {
  const press = (button: HTMLElement) => {
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  }
  const release = (button: HTMLElement) => {
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  }

  it('lets go of the door again', () => {
    const state = mount({ canInteract: true })
    const enter = screen.getByRole('button', { name: /enter/i })

    act(() => press(enter))
    expect(state.current.interact, 'the press never reached the controls').toBe(true)

    act(() => release(enter))
    expect(state.current.interact, 'the door stayed held, so it opens once and never again').toBe(
      false,
    )
  })

  it('releases when the thumb slides off before lifting', () => {
    const state = mount()
    const jump = screen.getByRole('button', { name: /jump/i })

    act(() => press(jump))
    expect(state.current.jump).toBe(true)

    // Lifted somewhere else entirely: the button never gets its own pointerup.
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup'))
    })
    expect(state.current.jump, 'a finger that wandered off left the control held').toBe(false)
  })

  it('keeps holding while the screen around it re-renders', () => {
    // Everything here re-renders as the player moves — a chair coming into
    // reach, a prop, the room. An effect with no dependency array runs its
    // cleanup on every one of those, and the cleanup lets go, so charging a
    // throw was cancelled by walking while charging it.
    const stateRef = createRef<TouchState>() as { current: TouchState }
    stateRef.current = createTouchState()
    const { rerender } = render(
      <TouchControls stateRef={stateRef} context={{ ...idle, canGrab: true, holding: true }} />,
    )

    const throwIt = screen.getByRole('button', { name: /throw/i })
    act(() => throwIt.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    expect(stateRef.current.grab).toBe(true)

    act(() => {
      rerender(
        <TouchControls
          stateRef={stateRef}
          context={{ ...idle, canGrab: true, holding: true, canSit: true }}
        />,
      )
    })
    expect(stateRef.current.grab, 'a re-render let go of the button').toBe(true)
  })

  it('holds the throw for as long as the thumb is down', () => {
    const state = mount({ canGrab: true, holding: true })
    const throwIt = screen.getByRole('button', { name: /throw/i })

    act(() => press(throwIt))
    expect(state.current.grab).toBe(true)
    act(() => release(throwIt))
    expect(state.current.grab).toBe(false)
  })
})

/**
 * Reaching the buttons without a pointer.
 *
 * `HoldButton` started a press only from `onPointerDown`, and the
 * `preventDefault` there also suppresses the click a browser would synthesize.
 * Assistive technology activates a button by dispatching `click` on its own —
 * so Sit, Pick up, Enter and Jump were unreachable with a screen reader, on a
 * device with no keyboard to fall back to.
 */
describe('activating a button another way', () => {
  it('answers a plain click', () => {
    vi.useFakeTimers()
    try {
      const state = mount({ canInteract: true })

      act(() => {
        screen.getByRole('button', { name: /enter/i }).click()
      })
      expect(state.current.interact, 'a screen reader could not open the door').toBe(true)

      act(() => {
        vi.advanceTimersByTime(EMOTE_PRESS_MS + 1)
      })
      expect(state.current.interact, 'the pulse never ended').toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not fire twice when a real tap synthesizes one', () => {
    const state = mount()
    const jump = screen.getByRole('button', { name: /jump/i })

    act(() => {
      jump.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      jump.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
      jump.click()
    })

    // The pointer press already ran and released; the click that follows it
    // must not start another one.
    expect(state.current.jump).toBe(false)
  })
})

/**
 * A tap is a press the frame loop has to be able to see. Down and up inside one
 * frame is a control nobody ever observed, which is a button that does nothing
 * every so often.
 */
describe('tapping an emote', () => {
  it('holds it long enough to be noticed, then lets go', () => {
    vi.useFakeTimers()
    try {
      const state = mount()
      act(() => {
        screen.getByRole('button', { name: /emotes and more/i }).click()
      })
      act(() => {
        screen.getByRole('button', { name: /^wave$/i }).click()
      })

      expect(state.current.emote).toBe('wave')
      act(() => {
        vi.advanceTimersByTime(EMOTE_PRESS_MS + 1)
      })
      expect(state.current.emote, 'the avatar would wave for ever').toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shuts the menu again, so the campus is what you see', () => {
    const state = mount()
    act(() => {
      screen.getByRole('button', { name: /emotes and more/i }).click()
    })
    act(() => {
      screen.getByRole('button', { name: /^point$/i }).click()
    })
    expect(state.current.emote).toBe('point')
    expect(screen.queryByRole('button', { name: /^point$/i })).not.toBeInTheDocument()
  })
})
