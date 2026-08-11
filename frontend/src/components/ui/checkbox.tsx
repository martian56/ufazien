"use client"

import React from "react"
import { Check } from "lucide-react"

/** `onCheckedChange` receives the boolean, not the event. */
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", checked, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <span className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="peer appearance-none h-[18px] w-[18px] rounded border border-gray-300 bg-white transition-colors checked:border-blue-600 checked:bg-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 cursor-pointer"
          {...props}
        />
        <Check
          className="pointer-events-none absolute h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
          strokeWidth={3}
          aria-hidden="true"
        />
      </span>
    )
  }
)

Checkbox.displayName = "Checkbox"

export { Checkbox }
