import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import Select from './Select'

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie', disabled: true },
]

afterEach(cleanup)

function setup(value = '', onChange = vi.fn()) {
  render(<Select value={value} onChange={onChange} options={OPTIONS} placeholder="Pick one" />)
  return { trigger: screen.getByRole('combobox'), onChange }
}

describe('Select', () => {
  it('shows the placeholder until something is chosen', () => {
    setup()
    expect(screen.getByRole('combobox')).toHaveTextContent('Pick one')
  })

  it('shows the label of the current value, not the raw value', () => {
    setup('b')
    expect(screen.getByRole('combobox')).toHaveTextContent('Bravo')
  })

  it('opens on click and lists the options', () => {
    const { trigger } = setup()
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('reports the chosen value', () => {
    const { trigger, onChange } = setup()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByText('Bravo'))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('does not report a disabled option', () => {
    const { trigger, onChange } = setup()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByText('Charlie'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('opens with the keyboard and commits with Enter', () => {
    const { trigger, onChange } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('skips disabled options when arrowing', () => {
    const { trigger, onChange } = setup('b')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('closes on Escape without choosing', () => {
    const { trigger, onChange } = setup()
    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('marks the trigger expanded while open', () => {
    const { trigger } = setup()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it('does not open when disabled', () => {
    render(<Select value="" onChange={vi.fn()} options={OPTIONS} disabled />)
    fireEvent.click(screen.getByRole('combobox'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
