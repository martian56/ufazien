import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
  "aria-label"?: string
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  id,
  className = "",
  "aria-label": ariaLabel,
}: SelectProps) {
  const generatedId = useId()
  const buttonId = id ?? generatedId
  const listId = `${buttonId}-listbox`

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef({ text: "", at: 0 })

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value])

  useEffect(() => {
    if (!open) return
    const index = options.findIndex((o) => o.value === value)
    setActiveIndex(index >= 0 ? index : 0)
  }, [open, options, value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const node = listRef.current.children[activeIndex] as HTMLElement | undefined
    node?.scrollIntoView?.({ block: "nearest" })
  }, [open, activeIndex])

  const commit = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  const step = (delta: number) => {
    if (!options.length) return
    let next = activeIndex
    for (let i = 0; i < options.length; i++) {
      next = (next + delta + options.length) % options.length
      if (!options[next].disabled) break
    }
    setActiveIndex(next)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!open && ["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return

    if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      step(1)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      step(-1)
    } else if (e.key === "Home") {
      e.preventDefault()
      setActiveIndex(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setActiveIndex(options.length - 1)
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      commit(activeIndex)
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now()
      typeahead.current.text = now - typeahead.current.at > 700 ? e.key : typeahead.current.text + e.key
      typeahead.current.at = now
      const needle = typeahead.current.text.toLowerCase()
      const found = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(needle))
      if (found >= 0) setActiveIndex(found)
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={buttonId}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left bg-white border rounded-lg text-sm transition-colors ${
          disabled
            ? "border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50"
            : "border-gray-300 text-gray-900 hover:border-gray-400 cursor-pointer"
        } ${open ? "border-blue-500 ring-2 ring-blue-500/20" : ""}`}
      >
        <span className={`truncate ${selected ? "" : "text-gray-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-activedescendant={`${listId}-${activeIndex}`}
          tabIndex={-1}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">No options</li>
          )}
          {options.map((option, index) => {
            const isSelected = option.value === value
            return (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(index)}
                className={`px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                  option.disabled
                    ? "text-gray-300 cursor-not-allowed"
                    : `cursor-pointer ${index === activeIndex ? "bg-blue-50 text-blue-900" : "text-gray-700"}`
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
