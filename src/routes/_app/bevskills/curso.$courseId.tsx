/**
 * BevSkills — Sala de Aula (PRD §4.1, RF-03 e RF-04).
 * Player à esquerda, navegação do curso à direita. A aula em que a
 * pessoa parou é retomada sozinha, e concluir uma aula já emenda na
 * próxima.
 */
import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Lock,
  PanelRightClose,
  PanelRightOpen,
  PlayCircle,
  Video,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import { cn } from '@/lib/utils'
import {
  getCurso,
  getProgressoCurso,
  proximaAula,
  RECURSO_LABEL,
  registrarVisita,
  setAulaConcluida,
  urlDeEmbed,
  type BevLesson,
  type ResourceTipo,
} from '@/lib/bevskills'

export const Route = createFileRoute('/_app/bevskills/curso/$courseId')({ component: SalaDeAula })

function SalaDeAula() {
  const { courseId } = Route.useParams()
  const { person } = useApp()
  const qc = useQueryClient()
  const [aulaId, setAulaId] = useState<string | null>(null)
  const [navAberta, setNavAberta] = useState(true)

  const cursoQ = useQuery({ queryKey: ['bev-curso', courseId], queryFn: () => getCurso(courseId) })
  const curso = cursoQ.data

  const todasAulas = useMemo(
    () => (curso?.modulos ?? []).flatMap((m) => m.aulas.map((a) => ({ ...a, bloqueado: m.bloqueado }))),
    [curso],
  )
  const lessonIds = useMemo(() => todasAulas.map((a) => a.id), [todasAulas])

  const progressoQ = useQuery({
    queryKey: ['bev-progresso', courseId, person.id],
    queryFn: () => getProgressoCurso(person.id, lessonIds),
    enabled: lessonIds.length > 0,
  })
  const progresso = progressoQ.data ?? []
  const concluidas = new Set(progresso.filter((p) => p.concluida_em).map((p) => p.lesson_id))

  // Retoma de onde parou assim que o curso e o progresso chegam.
  useEffect(() => {
    if (aulaId || !curso || progressoQ.isPending) return
    const alvo = proximaAula(curso, progresso)
    if (alvo) setAulaId(alvo.id)
  }, [curso, progresso, progressoQ.isPending, aulaId])

  const aula = todasAulas.find((a) => a.id === aulaId) ?? null

  useEffect(() => {
    if (aula && !aula.bloqueado) registrarVisita(person.id, aula.id).catch(() => {})
  }, [aula?.id, person.id])

  const indice = todasAulas.findIndex((a) => a.id === aulaId)
  const proxima = indice >= 0 ? todasAulas[indice + 1] : undefined

  const concluirMut = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: boolean }) =>
      setAulaConcluida(person.id, id, valor),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['bev-progresso', courseId, person.id] })
      qc.invalidateQueries({ queryKey: ['bevskills-catalogo'] })
      if (v.valor && proxima && !proxima.bloqueado) setAulaId(proxima.id)
    },
  })

  if (cursoQ.isPending) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="aspect-video w-full rounded-xl" />
      </div>
    )
  }

  if (cursoQ.isError || !curso) {
    return (
      <div className="mx-auto max-w-lg pt-16">
        <EmptyState
          icon={Lock}
          title="Curso indisponível"
          description="Ele pode ter sido despublicado ou você não tem acesso a esta diretoria."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/bevskills">Voltar ao catálogo</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const total = todasAulas.filter((a) => !a.bloqueado).length
  const feitas = todasAulas.filter((a) => !a.bloqueado && concluidas.has(a.id)).length
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0

  if (curso.status === 'em_breve') {
    return (
      <div className="mx-auto max-w-2xl">
        <Voltar />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              <Lock className="size-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight">{curso.titulo}</h1>
            {curso.descricao && (
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
                {curso.descricao}
              </p>
            )}
            <Badge variant="info">Em breve · {curso.diretoria.nome}</Badge>
          </CardContent>
        </Card>
      </div>
    )
  }

  const embed = urlDeEmbed(aula?.video_url ?? null, aula?.video_fonte ?? null)

  return (
    <div className="mx-auto max-w-6xl">
      <Voltar />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">{curso.titulo}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {curso.diretoria.nome}
            {curso.instrutor && ` · ${curso.instrutor}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium tabular-nums">{pct}%</p>
            <p className="text-muted-foreground text-xs">
              {feitas} de {total} {total === 1 ? 'aula' : 'aulas'}
            </p>
          </div>
          <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
            <div className="bg-status-success h-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="hidden size-8 lg:inline-flex"
            aria-label={navAberta ? 'Ocultar navegação' : 'Mostrar navegação'}
            onClick={() => setNavAberta((v) => !v)}
          >
            {navAberta ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>
        </div>
      </div>

      <div className={cn('grid grid-cols-1 gap-5', navAberta && 'lg:grid-cols-3')}>
        <div className={cn('flex flex-col gap-4', navAberta && 'lg:col-span-2')}>
          <div className="bg-muted aspect-video w-full overflow-hidden rounded-xl border">
            {embed ? (
              <iframe
                key={embed}
                src={embed}
                title={aula?.titulo ?? 'Aula'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="size-full"
              />
            ) : (
              <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-2 text-center text-sm">
                <Video className="size-6" />
                {aula
                  ? aula.video_url
                    ? 'O link deste vídeo não pôde ser convertido em player. Confira a URL no CMS.'
                    : 'Esta aula ainda não tem vídeo.'
                  : 'Selecione uma aula ao lado para começar.'}
              </div>
            )}
          </div>

          {aula && (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight">{aula.titulo}</h2>
                  {curso.instrutor && (
                    <p className="text-muted-foreground mt-0.5 text-sm">com {curso.instrutor}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={concluidas.has(aula.id) ? 'outline' : 'default'}
                  disabled={concluirMut.isPending}
                  onClick={() =>
                    concluirMut.mutate({ id: aula.id, valor: !concluidas.has(aula.id) })
                  }
                >
                  {concluidas.has(aula.id) ? (
                    <>
                      <CheckCircle2 className="size-4" />
                      Concluída
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      Marcar como concluída
                    </>
                  )}
                </Button>
              </div>

              {aula.descricao && (
                <p className="text-muted-foreground mt-2.5 whitespace-pre-wrap text-sm leading-relaxed">
                  {aula.descricao}
                </p>
              )}

              {aula.recursos.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">
                    Recursos complementares
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {aula.recursos.map((r) => (
                      <a
                        key={r.id}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-accent/50 hover:border-ring flex items-center gap-2.5 rounded-lg border p-2.5 text-sm transition-colors"
                      >
                        <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                          <IconeRecurso tipo={r.tipo} />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{r.titulo}</span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {RECURSO_LABEL[r.tipo]}
                        </span>
                        <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {navAberta && (
          <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
            <NavegacaoCurso
              modulos={curso.modulos}
              aulaAtual={aulaId}
              concluidas={concluidas}
              onSelecionar={setAulaId}
            />
          </aside>
        )}
      </div>
    </div>
  )
}

function Voltar() {
  return (
    <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2 mb-3">
      <Link to="/bevskills">
        <ArrowLeft className="size-4" />
        BevSkills
      </Link>
    </Button>
  )
}

function NavegacaoCurso({
  modulos,
  aulaAtual,
  concluidas,
  onSelecionar,
}: {
  modulos: Array<{ id: string; titulo: string; bloqueado: boolean; aulas: BevLesson[] }>
  aulaAtual: string | null
  concluidas: Set<string>
  onSelecionar: (id: string) => void
}) {
  const [fechados, setFechados] = useState<Set<string>>(new Set())

  if (modulos.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6 text-center text-sm">
          Este curso ainda não tem módulos publicados.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3">
        {modulos.map((m, i) => {
          const aberto = !fechados.has(m.id)
          const feitas = m.aulas.filter((a) => concluidas.has(a.id)).length
          return (
            <div key={m.id}>
              <button
                type="button"
                onClick={() =>
                  setFechados((s) => {
                    const n = new Set(s)
                    n.has(m.id) ? n.delete(m.id) : n.add(m.id)
                    return n
                  })
                }
                className="hover:bg-accent/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
              >
                <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.titulo}</span>
                  <span className="text-muted-foreground block text-xs">
                    {m.bloqueado
                      ? 'Em breve'
                      : m.aulas.length === 0
                        ? 'Sem aulas ainda'
                        : `${feitas}/${m.aulas.length} concluídas`}
                  </span>
                </span>
                {m.bloqueado ? (
                  <Lock className="text-muted-foreground size-3.5 shrink-0" />
                ) : (
                  <ChevronDown
                    className={cn(
                      'text-muted-foreground size-4 shrink-0 transition-transform duration-200',
                      !aberto && '-rotate-90',
                    )}
                  />
                )}
              </button>

              {aberto && !m.bloqueado && m.aulas.length > 0 && (
                <ol className="mt-1 flex flex-col gap-0.5 pl-2">
                  {m.aulas.map((a) => {
                    const ativa = a.id === aulaAtual
                    const feita = concluidas.has(a.id)
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => onSelecionar(a.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                            ativa ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-accent/40',
                          )}
                        >
                          {feita ? (
                            <CheckCircle2 className="text-status-success size-4 shrink-0" />
                          ) : (
                            <PlayCircle
                              className={cn(
                                'size-4 shrink-0',
                                ativa ? 'text-foreground' : 'text-muted-foreground',
                              )}
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate">{a.titulo}</span>
                          {a.duracao_min ? (
                            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                              {a.duracao_min} min
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function IconeRecurso({ tipo }: { tipo: ResourceTipo }) {
  if (tipo === 'arquivo') return <FileText className="size-3.5" />
  return <ExternalLink className="size-3.5" />
}
