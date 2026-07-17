import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Paleta de badges de status transversal (Blueprint §8):
 * cinza (não iniciado), azul (em andamento), amarelo (aguardando
 * revisão/aprovação), verde (concluído), vermelho (atrasado/rejeitado).
 * Sempre via tokens — nunca cor fixa.
 */
const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        neutral: 'border-transparent bg-status-neutral-bg text-status-neutral',
        info: 'border-transparent bg-status-info-bg text-status-info',
        warning: 'border-transparent bg-status-warning-bg text-status-warning',
        success: 'border-transparent bg-status-success-bg text-status-success',
        danger: 'border-transparent bg-status-danger-bg text-status-danger',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
