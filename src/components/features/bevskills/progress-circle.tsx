import { cn } from '@/lib/utils'

/**
 * Anel de progresso circular (SVG) — usado no resumo do aluno e nos
 * cabeçalhos de curso. Anima o traço via stroke-dashoffset.
 */
export function ProgressCircle({
  value,
  size = 72,
  stroke = 7,
  className,
  label,
}: {
  value: number
  size?: number
  stroke?: number
  className?: string
  /** Conteúdo central; se ausente, mostra "NN%". */
  label?: React.ReactNode
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const done = pct >= 100

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn(
            'transition-[stroke-dashoffset] duration-700 ease-out',
            done ? 'stroke-status-success' : 'stroke-primary',
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label ?? (
          <span className="text-sm font-bold tabular-nums">{pct}%</span>
        )}
      </div>
    </div>
  )
}
