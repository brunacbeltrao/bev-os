import { cn } from '@/lib/utils'

/**
 * Controle segmentado para filtros exclusivos (ex.: Todos · Em
 * andamento · Concluído). Substitui fileiras de botões avulsos.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; count?: number }>
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('bg-muted inline-flex items-center gap-0.5 rounded-lg p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'focus-visible:ring-ring/60 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
              active
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                  active ? 'bg-accent text-accent-foreground' : 'bg-secondary',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
