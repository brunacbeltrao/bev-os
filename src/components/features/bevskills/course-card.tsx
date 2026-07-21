/**
 * Card de curso da vitrine (PRD §2, pilares 1, 3 e 4).
 * · Publicado: clica e entra.
 * · Em breve: capa escurecida, cadeado discreto e selo — desperta
 *   expectativa em vez de parecer erro. Não é clicável.
 * · Rascunho: só quem administra a diretoria enxerga.
 */
import { Link } from '@tanstack/react-router'
import { Lock, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CatalogoItem } from '@/lib/bevskills'

export function CourseCard({ curso, largura = 'w-64' }: { curso: CatalogoItem; largura?: string }) {
  const emBreve = curso.status === 'em_breve'
  const pct =
    curso.total_aulas > 0 ? Math.round((curso.aulas_concluidas / curso.total_aulas) * 100) : 0
  const comecou = curso.aulas_concluidas > 0 && pct < 100
  const concluido = curso.total_aulas > 0 && pct === 100

  const capa = (
    <div
      className={cn(
        'bg-muted relative aspect-video w-full overflow-hidden rounded-xl border',
        !emBreve && 'group-hover:border-ring',
      )}
    >
      {curso.capa_url ? (
        <img
          src={curso.capa_url}
          alt=""
          loading="lazy"
          className={cn(
            'size-full object-cover transition-transform duration-300',
            !emBreve && 'group-hover:scale-105',
          )}
        />
      ) : (
        <div className="from-accent to-muted flex size-full items-center justify-center bg-gradient-to-br p-4">
          <span className="text-muted-foreground line-clamp-3 text-center text-sm font-semibold">
            {curso.titulo}
          </span>
        </div>
      )}

      {emBreve && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/65 backdrop-blur-[1px]">
          <Lock className="size-5 text-white/80" />
          <span className="rounded-full border border-white/25 px-2 py-0.5 text-[11px] font-medium text-white/90">
            Em breve
          </span>
        </div>
      )}

      {!emBreve && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/35 group-hover:opacity-100">
          <span className="flex size-11 items-center justify-center rounded-full bg-white/90 text-black">
            <Play className="size-5 translate-x-px fill-current" />
          </span>
        </div>
      )}

      {curso.status === 'rascunho' && (
        <span className="absolute left-2 top-2">
          <Badge variant="neutral">Rascunho</Badge>
        </span>
      )}

      {comecou && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
          <div className="bg-status-success h-full" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )

  const legenda = (
    <div className="mt-2">
      <p className="truncate text-sm font-medium">{curso.titulo}</p>
      <p className="text-muted-foreground truncate text-xs">
        {emBreve
          ? 'Chegando em breve'
          : concluido
            ? 'Concluído'
            : comecou
              ? `${pct}% concluído · continuar`
              : curso.total_aulas > 0
                ? `${curso.total_aulas} ${curso.total_aulas === 1 ? 'aula' : 'aulas'}`
                : 'Conteúdo em montagem'}
        {curso.instrutor && ` · ${curso.instrutor}`}
      </p>
    </div>
  )

  if (emBreve) {
    return (
      <div
        className={cn('shrink-0 cursor-default select-none', largura)}
        aria-disabled="true"
        title="Este curso ainda não foi lançado"
      >
        {capa}
        {legenda}
      </div>
    )
  }

  return (
    <Link
      to="/bevskills/curso/$courseId"
      params={{ courseId: curso.id }}
      className={cn(
        'group focus-visible:ring-ring/60 shrink-0 rounded-xl transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2',
        largura,
      )}
    >
      {capa}
      {legenda}
    </Link>
  )
}
