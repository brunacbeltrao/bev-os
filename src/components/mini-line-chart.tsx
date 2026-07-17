/**
 * Gráfico de linha minimalista em SVG (sem dependência externa).
 * Usado no dashboard de Negócios: Meta × Realizado acumulado ao longo
 * dos meses. `realizado` nulo = mês futuro (a linha para no último valor).
 */
export interface LinePoint {
  label: string
  meta: number
  realizado: number | null
}

export function MiniLineChart({ points, height = 140 }: { points: LinePoint[]; height?: number }) {
  const W = 340
  const H = height
  const padL = 8
  const padR = 8
  const padT = 10
  const padB = 20
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const maxV = Math.max(1, ...points.map((p) => Math.max(p.meta, p.realizado ?? 0)))
  const n = points.length
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW)
  const y = (v: number) => padT + innerH - (v / maxV) * innerH

  const metaPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.meta)}`).join(' ')
  const realPts = points.filter((p) => p.realizado != null)
  const lastReal = realPts.length - 1
  const realPath = realPts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(points.indexOf(p))} ${y(p.realizado as number)}`)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Meta versus realizado">
        {/* linha de base */}
        <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} className="stroke-border" strokeWidth={1} />
        {/* meta (tracejada, esmaecida) */}
        <g className="text-muted-foreground">
          <path d={metaPath} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" />
        </g>
        {/* realizado (cheia, destaque) */}
        <g className="text-primary">
          {realPath && <path d={realPath} fill="none" stroke="currentColor" strokeWidth={2} />}
          {realPts.map((p, i) => (
            <circle
              key={p.label}
              cx={x(points.indexOf(p))}
              cy={y(p.realizado as number)}
              r={i === lastReal ? 3 : 1.8}
              fill="currentColor"
            />
          ))}
        </g>
        {/* rótulos de mês */}
        {points.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 8 }}>
            {p.label}
          </text>
        ))}
      </svg>
      <div className="text-muted-foreground flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-primary inline-block h-0.5 w-4 rounded" /> Realizado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t border-dashed border-current" /> Meta
        </span>
      </div>
    </div>
  )
}
