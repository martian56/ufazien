import React from "react"

interface RangeProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  value: number
  min?: number
  max?: number
  step?: number
  onValueChange: (value: number) => void
}

const Range = React.forwardRef<HTMLInputElement, RangeProps>(
  ({ className = "", value, min = 0, max = 100, step = 1, onValueChange, disabled, ...props }, ref) => {
    const filled = max === min ? 0 : ((value - min) / (max - min)) * 100
    return (
      <input
        type="range"
        ref={ref}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onValueChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--color-blue-600) ${filled}%, var(--color-gray-200) ${filled}%)`,
        }}
        className={`ufz-range h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    )
  }
)

Range.displayName = "Range"

export { Range }
export default Range
