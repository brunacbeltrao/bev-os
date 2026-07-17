import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Estado vazio padrão: ícone em disco suave, título curto, texto de
 * apoio que orienta o próximo passo e ação opcional.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground mb-1.5 flex size-11 items-center justify-center rounded-full">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description && (
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
