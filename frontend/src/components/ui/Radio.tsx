import React from "react"

interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "onSelect" | "type"> {
  onSelect?: (value: string) => void
}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className = "", checked, disabled, value, onSelect, ...props }, ref) => (
    <span className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <input
        type="radio"
        ref={ref}
        checked={checked}
        disabled={disabled}
        value={value}
        onChange={(e) => onSelect?.(e.target.value)}
        className="peer appearance-none h-[18px] w-[18px] rounded-full border border-gray-300 bg-white transition-colors checked:border-blue-600 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 cursor-pointer"
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute h-2 w-2 rounded-full bg-blue-600 opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  )
)

Radio.displayName = "Radio"

export { Radio }
export default Radio
