import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'w-full rounded-md border border-gray-300 px-3 py-2 text-sm',
            'placeholder:text-gray-400',
            'focus:border-oca-blue focus:outline-none focus:ring-1 focus:ring-oca-blue',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
            error && 'border-oca-red focus:border-oca-red focus:ring-oca-red',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-oca-red">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
