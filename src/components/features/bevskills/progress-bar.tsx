import { cn } from '@/lib/utils'

/**
 * Barra de progresso linear — % de conclusão de um curso/trilha.
 * Usa tokens do tema; verde institucional quando 100%.
 */
export function ProgressBar({
  value,
  className,
  showLabel = false,
  size = 'md',
}: {
  value: number
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const done = pct >= 100
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'bg-muted relative w-full overflow-hidden rounded-full',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            done ? 'bg-status-success' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-muted-foreground w-9 shrink-0 text-right text-xs font-semibold tabular-nums">
          {pct}%
        </span>
      )}
    </div>
  )
}
