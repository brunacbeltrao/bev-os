import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'border-input bg-card placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 flex min-h-[70px] w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
