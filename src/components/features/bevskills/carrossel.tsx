/** Fileira horizontal com rolagem suave (PRD §2, pilar 1). */
import { useRef, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Carrossel({
  titulo,
  cor,
  acao,
  children,
}: {
  titulo: string
  cor?: string
  acao?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  function rolar(dir: -1 | 1) {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 240), behavior: 'smooth' })
  }

  return (
    <section className="group/row">
      <div className="mb-2.5 flex items-center gap-2">
        {cor && <span className={cn('size-2 shrink-0 rounded-full', cor)} />}
        <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>
        <div className="ml-auto flex items-center gap-1">
          {acao}
          <button
            type="button"
            aria-label={`Rolar ${titulo} para a esquerda`}
            onClick={() => rolar(-1)}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Rolar ${titulo} para a direita`}
            onClick={() => rolar(1)}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 items-center justify-center rounded-full transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  )
}
