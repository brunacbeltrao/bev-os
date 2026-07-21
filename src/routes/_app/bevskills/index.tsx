/**
 * BevSkills — Home (PRD §4.1).
 * Vitrine estilo streaming: uma fileira por diretoria, "Continuar
 * assistindo" no topo quando faz sentido, e busca com filtro.
 */
import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { GraduationCap, Search, Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  agruparPorDiretoria,
  COR_DIRETORIA,
  getCatalogo,
  type CatalogoItem,
} from '@/lib/bevskills'
import { CourseCard } from '@/components/features/bevskills/course-card'
import { Carrossel } from '@/components/features/bevskills/carrossel'

export const Route = createFileRoute('/_app/bevskills/')({ component: BevSkillsHome })

function BevSkillsHome() {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<string | null>(null)

  const q = useQuery({ queryKey: ['bevskills-catalogo'], queryFn: getCatalogo })
  const catalogo = q.data ?? []

  const podeGerir = catalogo.some((c) => c.pode_gerir)

  const continuar = useMemo(
    () =>
      catalogo
        .filter(
          (c) =>
            c.status === 'publicado' &&
            c.ultima_aula_em &&
            c.aulas_concluidas < c.total_aulas,
        )
        .sort((a, b) => (b.ultima_aula_em ?? '').localeCompare(a.ultima_aula_em ?? ''))
        .slice(0, 12),
    [catalogo],
  )

  const termo = busca.trim().toLowerCase()
  const buscando = termo.length > 0 || filtro !== null

  const resultados = useMemo(() => {
    return catalogo.filter((c) => {
      if (filtro && c.diretoria_slug !== filtro) return false
      if (!termo) return true
      return [c.titulo, c.descricao, c.instrutor, c.diretoria]
        .filter(Boolean)
        .some((campo) => (campo as string).toLowerCase().includes(termo))
    })
  }, [catalogo, termo, filtro])

  const fileiras = useMemo(() => agruparPorDiretoria(catalogo), [catalogo])
  const diretorias = useMemo(
    () => agruparPorDiretoria(catalogo).map((f) => ({ slug: f.slug, nome: f.nome })),
    [catalogo],
  )

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
              <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <GraduationCap className="size-4.5" />
              </span>
              BevSkills
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              O acervo de capacitações do BEV. Aprenda no seu ritmo — o conhecimento fica, mesmo
              quando a gestão troca.
            </p>
          </div>
          {podeGerir && (
            <Button asChild variant="outline" size="sm">
              <Link to="/bevskills/gerenciar">
                <Settings2 className="size-4" />
                Gerenciar catálogo
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          <div className="relative max-w-md">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por curso, tema ou instrutor…"
              className="pl-9 pr-9"
            />
            {busca && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => setBusca('')}
                className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {diretorias.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip ativo={filtro === null} onClick={() => setFiltro(null)}>
                Todas
              </Chip>
              {diretorias.map((d) => (
                <Chip
                  key={d.slug}
                  ativo={filtro === d.slug}
                  cor={COR_DIRETORIA[d.slug]}
                  onClick={() => setFiltro(filtro === d.slug ? null : d.slug)}
                >
                  {d.nome}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </header>

      {q.isPending ? (
        <div className="flex flex-col gap-6">
          <FileiraEsqueleto />
          <FileiraEsqueleto />
        </div>
      ) : catalogo.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="O catálogo ainda está vazio"
          description="Assim que as diretorias publicarem as primeiras capacitações, elas aparecem aqui."
        />
      ) : buscando ? (
        <Resultados itens={resultados} />
      ) : (
        <div className="flex flex-col gap-7">
          {continuar.length > 0 && (
            <Carrossel titulo="Continuar assistindo">
              {continuar.map((c) => (
                <CourseCard key={`cont-${c.id}`} curso={c} />
              ))}
            </Carrossel>
          )}

          {fileiras.map((f) => (
            <Carrossel key={f.slug} titulo={f.nome} cor={COR_DIRETORIA[f.slug]}>
              {f.cursos.map((c) => (
                <CourseCard key={c.id} curso={c} />
              ))}
            </Carrossel>
          ))}
        </div>
      )}
    </div>
  )
}

function Resultados({ itens }: { itens: CatalogoItem[] }) {
  if (itens.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Nada encontrado"
        description="Tente outra palavra ou tire o filtro de diretoria."
      />
    )
  }
  return (
    <>
      <p className="text-muted-foreground mb-3 text-sm">
        {itens.length} {itens.length === 1 ? 'curso encontrado' : 'cursos encontrados'}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
        {itens.map((c) => (
          <CourseCard key={c.id} curso={c} largura="w-full" />
        ))}
      </div>
    </>
  )
}

function Chip({
  ativo,
  cor,
  onClick,
  children,
}: {
  ativo: boolean
  cor?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        ativo ? 'bg-accent border-ring text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
      }`}
    >
      {cor && <span className={`size-1.5 rounded-full ${cor}`} />}
      {children}
    </button>
  )
}

function FileiraEsqueleto() {
  return (
    <div>
      <Skeleton className="mb-2.5 h-5 w-40" />
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-video w-64 shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
