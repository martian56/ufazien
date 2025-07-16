"use client"

import React from "react"

const Checkbox = React.forwardRef(({ className = "", checked, onCheckedChange, ...props }, ref) => {
  return (
    <input
      type="checkbox"
      className={`h-4 w-4 rounded border border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 ${className}`}
      ref={ref}
      checked={checked}
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
      {...props}
    />
  )
})

Checkbox.displayName = "Checkbox"

export { Checkbox }
