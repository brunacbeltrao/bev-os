/**
 * BevSkills — CMS descentralizado (PRD §4.2, RF-05).
 * Cada diretoria cuida da própria vitrine: a liderança vê e edita só
 * os cursos da diretoria em que tem vínculo. P&C enxerga tudo.
 */
import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Lock, Plus, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useApp } from '@/lib/app-context'
import {
  COR_DIRETORIA,
  criarCurso,
  getCatalogo,
  getDiretorias,
  STATUS_BADGE,
  STATUS_LABEL,
  type CatalogoItem,
  type CourseStatus,
} from '@/lib/bevskills'
import { CursoEditor } from '@/components/features/bevskills/curso-editor'

export const Route = createFileRoute('/_app/bevskills/gerenciar')({ component: GerenciarPage })

const CAMPO =
  'border-input bg-card focus-visible:ring-ring/60 h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2'

function GerenciarPage() {
  const { person, occupations, souPC } = useApp()
  const qc = useQueryClient()
  const [editando, setEditando] = useState<string | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)

  const catalogoQ = useQuery({ queryKey: ['bevskills-catalogo'], queryFn: getCatalogo })
  const diretoriasQ = useQuery({ queryKey: ['bev-diretorias'], queryFn: getDiretorias })

  const meus = useMemo(
    () => (catalogoQ.data ?? []).filter((c) => c.pode_gerir),
    [catalogoQ.data],
  )

  /** Diretorias em que eu posso publicar. */
  const minhasDiretorias = useMemo(() => {
    const todas = diretoriasQ.data ?? []
    if (souPC) return todas
    const ids = new Set(
      occupations
        .filter((o) => ['diretor', 'gerente', 'coordenador'].includes(o.role))
        .map((o) => o.directorate.id),
    )
    return todas.filter((d) => ids.has(d.id))
  }, [diretoriasQ.data, occupations, souPC])

  const criarMut = useMutation({
    mutationFn: (v: { directorate_id: string; titulo: string; status: CourseStatus }) =>
      criarCurso({ ...v, criado_por: person.id }),
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['bevskills-catalogo'] })
      setNovoAberto(false)
      setEditando(id)
    },
  })

  if (minhasDiretorias.length === 0 && !catalogoQ.isPending) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Somente lideranças</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          O catálogo de cada diretoria é mantido por diretores, gerentes e coordenadores dela.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/bevskills">Voltar ao BevSkills</Link>
        </Button>
      </div>
    )
  }

  if (editando) {
    return (
      <div className="mx-auto max-w-4xl">
        <CursoEditor courseId={editando} onVoltar={() => setEditando(null)} />
      </div>
    )
  }

  const porDiretoria = new Map<string, CatalogoItem[]>()
  for (const c of meus) {
    if (!porDiretoria.has(c.diretoria_slug)) porDiretoria.set(c.diretoria_slug, [])
    porDiretoria.get(c.diretoria_slug)!.push(c)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2 mb-3">
        <Link to="/bevskills">
          <ArrowLeft className="size-4" />
          BevSkills
        </Link>
      </Button>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Settings2 className="size-4.5" />
            </span>
            Gerenciar catálogo
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {souPC
              ? 'Você tem acesso geral: pode publicar em qualquer diretoria.'
              : `Você publica em ${minhasDiretorias.map((d) => d.nome).join(', ')}.`}
          </p>
        </div>
        <Button size="sm" onClick={() => setNovoAberto(true)}>
          <Plus className="size-4" />
          Novo curso
        </Button>
      </header>

      {catalogoQ.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : meus.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="Nenhum curso ainda"
          description="Crie o primeiro curso da sua diretoria. Ele nasce como rascunho — só vai para a vitrine quando você publicar."
          action={
            <Button size="sm" onClick={() => setNovoAberto(true)}>
              <Plus className="size-4" />
              Criar curso
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...porDiretoria.entries()].map(([slug, cursos]) => (
            <section key={slug}>
              <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <span className={`size-2 rounded-full ${COR_DIRETORIA[slug] ?? 'bg-muted'}`} />
                {cursos[0].diretoria}
                <span className="bg-muted rounded-full px-1.5 py-0.5 text-[10px]">{cursos.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {cursos.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setEditando(c.id)}
                    className="bg-card hover:bg-accent/50 hover:border-ring flex items-center gap-3 rounded-xl border p-3 text-left transition-colors"
                  >
                    <div className="bg-muted aspect-video w-24 shrink-0 overflow-hidden rounded-md border">
                      {c.capa_url && (
                        <img src={c.capa_url} alt="" className="size-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.titulo}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {c.total_aulas} {c.total_aulas === 1 ? 'aula' : 'aulas'}
                        {c.instrutor && ` · ${c.instrutor}`}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <NovoCursoDialog
        aberto={novoAberto}
        onFechar={() => setNovoAberto(false)}
        diretorias={minhasDiretorias}
        salvando={criarMut.isPending}
        onCriar={(v) => criarMut.mutate(v)}
      />
    </div>
  )
}

function NovoCursoDialog({
  aberto,
  onFechar,
  diretorias,
  salvando,
  onCriar,
}: {
  aberto: boolean
  onFechar: () => void
  diretorias: Array<{ id: string; nome: string }>
  salvando: boolean
  onCriar: (v: { directorate_id: string; titulo: string; status: CourseStatus }) => void
}) {
  const [titulo, setTitulo] = useState('')
  const [dir, setDir] = useState('')
  const [status, setStatus] = useState<CourseStatus>('rascunho')

  const dirEfetiva = dir || diretorias[0]?.id || ''

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo curso</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (titulo.trim() && dirEfetiva)
              onCriar({ directorate_id: dirEfetiva, titulo: titulo.trim(), status })
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="n-titulo">Título</Label>
            <Input
              id="n-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: SPIN Selling"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="n-dir">Diretoria</Label>
            <select
              id="n-dir"
              className={CAMPO}
              value={dirEfetiva}
              onChange={(e) => setDir(e.target.value)}
            >
              {diretorias.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="n-status">Status</Label>
            <select
              id="n-status"
              className={CAMPO}
              value={status}
              onChange={(e) => setStatus(e.target.value as CourseStatus)}
            >
              <option value="rascunho">Rascunho — só a liderança vê</option>
              <option value="em_breve">Em breve — aparece com cadeado</option>
              <option value="publicado">Publicado — liberado para todos</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!titulo.trim() || salvando}>
              Criar e editar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
