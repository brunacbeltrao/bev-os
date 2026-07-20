/**
 * Benchs — registro dos benchmarks realizados pelo BEV.
 * Cada bench é classificado (outra EJ / pós-júnior / membro do BEV /
 * outro), aceita vários participantes (inclusive de EJs diferentes) e
 * tem um espaço dedicado para insights e aprendizados.
 * A leitura é institucional: todo mundo vê o que a casa aprendeu.
 */
import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Award,
  Building2,
  Lock,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import * as B from '@/lib/benchs'
import { fmtDate, useContextScope } from '@/lib/use-context-scope'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/benchs')({ component: BenchsPage })

const TIPO_VARIANT: Record<B.BenchTipo, 'info' | 'success' | 'warning' | 'neutral'> = {
  ej: 'info',
  pos_junior: 'success',
  membro_bev: 'warning',
  outro: 'neutral',
}

function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm shadow-xs transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2',
        className,
      )}
    />
  )
}

// ============================================================
// Faixa de gamificação
// ============================================================
function Estatistica({
  icone: Icone,
  valor,
  rotulo,
}: {
  icone: typeof Sparkles
  valor: number
  rotulo: string
}) {
  return (
    <div className="bg-accent/40 flex flex-col items-center rounded-lg p-2.5">
      <Icone className="text-muted-foreground mb-1 size-4" />
      <span className="text-xl font-bold leading-none">{valor}</span>
      <span className="text-muted-foreground mt-0.5 text-[11px]">{rotulo}</span>
    </div>
  )
}

function ProgressoNivel({ benchs }: { benchs: B.Bench[] }) {
  const pontos = benchs.reduce((s, b) => s + B.pontosDoBench(b), 0)
  const nivel = B.nivelPorPontos(pontos)
  const documentados = benchs.filter(B.isDocumentado).length
  const orgs = new Set(
    benchs.flatMap((b) => B.organizacoesDistintas(b).map((o) => o.toLowerCase())),
  ).size
  const faixa = nivel.topo - nivel.base
  const pct = faixa > 0 ? Math.min(100, Math.round(((pontos - nivel.base) / faixa) * 100)) : 100

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-primary text-primary-foreground flex size-14 shrink-0 flex-col items-center justify-center rounded-xl">
            <span className="text-lg font-bold leading-none">{nivel.nivel}</span>
            <span className="text-[9px] uppercase tracking-wide opacity-80">nível</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{nivel.titulo}</p>
            <p className="text-muted-foreground text-xs">
              {pontos} pontos
              {nivel.faltam > 0
                ? ` · faltam ${nivel.faltam} para o próximo nível`
                : ' · nível máximo'}
            </p>
            <div className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Estatistica icone={Sparkles} valor={benchs.length} rotulo="benchs" />
          <Estatistica icone={Star} valor={documentados} rotulo="documentados" />
          <Estatistica icone={Building2} valor={orgs} rotulo="organizações" />
          <Estatistica
            icone={Users}
            valor={benchs.reduce((s, b) => s + Math.max(1, b.participantes.length), 0)}
            rotulo="pessoas"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function Conquistas({ benchs }: { benchs: B.Bench[] }) {
  const conquistas = B.calcularConquistas(benchs)
  const total = conquistas.filter((c) => c.desbloqueada).length
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Trophy className="size-4" />
          <h2 className="text-base font-semibold">Conquistas</h2>
          <Badge variant="secondary" className="ml-auto">
            {total}/{conquistas.length}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {conquistas.map((c) => (
            <div
              key={c.slug}
              title={c.descricao}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors',
                c.desbloqueada ? 'border-primary/40 bg-primary/10' : 'bg-muted/30 opacity-60',
              )}
            >
              {c.desbloqueada ? (
                <Award className="text-primary size-5" />
              ) : (
                <Lock className="text-muted-foreground size-5" />
              )}
              <span className="text-xs font-medium leading-tight">{c.titulo}</span>
              <span className="text-muted-foreground text-[10px]">
                {c.progresso}/{c.alvo}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Formulário de novo bench
// ============================================================
interface ParticipanteForm {
  nome: string
  email: string
  organizacao: string
}

function NovoBenchDialog({ onCriado }: { onCriado: () => void }) {
  const { person } = useApp()
  const { scopeSubareas } = useContextScope()
  const [open, setOpen] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [tipo, setTipo] = useState<B.BenchTipo>('ej')
  const [tema, setTema] = useState('')
  const [data, setData] = useState('')
  const [meetUrl, setMeetUrl] = useState('')
  const [subareaId, setSubareaId] = useState('')
  const [parts, setParts] = useState<ParticipanteForm[]>([
    { nome: '', email: '', organizacao: '' },
  ])

  const precisaOrg = tipo !== 'membro_bev'

  const criarMut = useMutation({
    mutationFn: () =>
      B.createBench({
        subarea_id: subareaId || scopeSubareas[0]?.id,
        tipo,
        tema: tema.trim(),
        data,
        meet_url: meetUrl,
        criado_por: person.id,
        participantes: parts
          .filter((p) => p.nome.trim())
          .map((p) => ({
            nome: p.nome.trim(),
            email: p.email.trim() || undefined,
            organizacao: p.organizacao.trim() || undefined,
            tipo,
          })),
      }),
    onSuccess: () => {
      setOpen(false)
      setTipo('ej')
      setTema('')
      setData('')
      setMeetUrl('')
      setParts([{ nome: '', email: '', organizacao: '' }])
      setErro(null)
      onCriado()
    },
    onError: () =>
      setErro('Não foi possível registrar o bench. Verifique suas permissões na área.'),
  })

  function atualizar(i: number, campo: keyof ParticipanteForm, valor: string) {
    setParts((ps) => ps.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)))
  }

  const orgsDistintas = new Set(
    parts.map((p) => p.organizacao.trim().toLowerCase()).filter(Boolean),
  ).size

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Registrar bench
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar bench realizado</DialogTitle>
        </DialogHeader>
        <form
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (tema.trim() && data && parts.some((p) => p.nome.trim())) criarMut.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Com quem foi o bench?</Label>
            <div className="grid grid-cols-2 gap-2">
              {B.TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    'rounded-lg border p-2.5 text-left transition-colors',
                    tipo === t ? 'border-primary bg-primary/10' : 'hover:bg-accent/50',
                  )}
                >
                  <span className="block text-sm font-medium">{B.TIPO_LABELS[t]}</span>
                  <span className="text-muted-foreground block text-[11px] leading-tight">
                    {B.TIPO_DESCRICAO[t]}
                  </span>
                  <span className="text-primary mt-1 block text-[10px] font-semibold">
                    +{B.TIPO_PONTOS[t]} pts
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Tema</Label>
              <Input
                required
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex.: estruturação de funil comercial"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Link do Meet</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={meetUrl}
                onChange={(e) => setMeetUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Participantes</Label>
              {orgsDistintas > 1 && (
                <Badge variant="success" className="text-[10px]">
                  Mesa redonda · +{B.PONTOS_MULTI_EJ} pts
                </Badge>
              )}
            </div>
            {parts.map((p, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border p-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nome"
                    value={p.nome}
                    onChange={(e) => atualizar(i, 'nome', e.target.value)}
                    required={i === 0}
                  />
                  {parts.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remover participante"
                      onClick={() => setParts((ps) => ps.filter((_, idx) => idx !== i))}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {precisaOrg && (
                    <Input
                      placeholder="EJ / organização"
                      value={p.organizacao}
                      onChange={(e) => atualizar(i, 'organizacao', e.target.value)}
                    />
                  )}
                  <Input
                    type="email"
                    placeholder="E-mail (opcional)"
                    value={p.email}
                    onChange={(e) => atualizar(i, 'email', e.target.value)}
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => setParts((ps) => [...ps, { nome: '', email: '', organizacao: '' }])}
            >
              <UserPlus className="size-4" />
              Adicionar participante
            </Button>
            <p className="text-muted-foreground text-[11px]">
              Participantes de EJs diferentes na mesma call valem pontos extras.
            </p>
          </div>

          {scopeSubareas.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label>Área</Label>
              <Select
                value={subareaId || scopeSubareas[0]?.id}
                onChange={(e) => setSubareaId(e.target.value)}
              >
                {scopeSubareas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Button type="submit" disabled={criarMut.isPending}>
            {criarMut.isPending ? 'Registrando…' : 'Registrar bench'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Detalhe / documentação
// ============================================================
function Bloco({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
        {titulo}
      </p>
      <p className="text-sm whitespace-pre-wrap">
        {texto || <span className="text-muted-foreground">Ainda não documentado.</span>}
      </p>
    </div>
  )
}

function BenchDetail({ bench }: { bench: B.Bench }) {
  const { person } = useApp()
  const { leadsSubarea } = useContextScope()
  const qc = useQueryClient()
  const [insights, setInsights] = useState(bench.insights ?? '')
  const [aprendizados, setAprendizados] = useState(bench.aprendizados ?? '')
  const [avaliacao, setAvaliacao] = useState<number | null>(bench.avaliacao)
  const [url, setUrl] = useState(bench.gravacao_url ?? '')

  const podeEditar = bench.criado_por === person.id || leadsSubarea(bench.subarea_id)

  const saveMut = useMutation({
    mutationFn: () =>
      B.saveBenchDocumentacao(bench.id, {
        insights,
        aprendizados,
        avaliacao,
        gravacao_url: url,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['benchs'] }),
  })
  const delMut = useMutation({
    mutationFn: () => B.deleteBench(bench.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['benchs'] }),
  })

  const orgs = B.organizacoesDistintas(bench)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant={TIPO_VARIANT[bench.tipo]}>{B.TIPO_LABELS[bench.tipo]}</Badge>
            <Badge variant="secondary">+{B.pontosDoBench(bench)} pts</Badge>
            {orgs.length > 1 && <Badge variant="success">Mesa redonda</Badge>}
          </div>
          <h2 className="text-lg font-semibold">{bench.tema || 'Sem tema'}</h2>
          <p className="text-muted-foreground text-sm">{fmtDate(bench.data, true)}</p>
        </div>
        {podeEditar && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Excluir bench"
            onClick={() => {
              if (confirm('Excluir este bench e sua documentação?')) delMut.mutate()
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Participantes
        </p>
        <div className="flex flex-wrap gap-2">
          {bench.participantes.length === 0 ? (
            <span className="text-muted-foreground text-sm">Nenhum participante registrado.</span>
          ) : (
            bench.participantes.map((p) => (
              <div key={p.id} className="bg-accent/40 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="font-medium">{p.nome}</span>
                {p.organizacao && <span className="text-muted-foreground"> · {p.organizacao}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {bench.meet_url && (
        <a
          href={bench.meet_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-sm hover:underline"
        >
          Abrir link da call
        </a>
      )}

      {podeEditar ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>Principais insights</Label>
            <Textarea
              className="min-h-[100px]"
              value={insights}
              onChange={(e) => setInsights(e.target.value)}
              placeholder="O que essa conversa revelou sobre como eles operam…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Aprendizados aplicáveis ao BEV</Label>
            <Textarea
              className="min-h-[80px]"
              value={aprendizados}
              onChange={(e) => setAprendizados(e.target.value)}
              placeholder="O que a gente pode testar aqui a partir disso…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Quanto esse bench valeu?</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} estrelas`}
                  onClick={() => setAvaliacao(n === avaliacao ? null : n)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'size-6',
                      avaliacao != null && n <= avaliacao
                        ? 'fill-primary text-primary'
                        : 'text-muted-foreground',
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Link da gravação</Label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <Button
            size="sm"
            className="self-start"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? 'Salvando…' : 'Salvar documentação'}
          </Button>
          {!B.isDocumentado(bench) && (
            <p className="text-muted-foreground text-xs">
              Documentar os insights vale +{B.PONTOS_DOCUMENTACAO} pontos.
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <Bloco titulo="Principais insights" texto={bench.insights} />
          <Bloco titulo="Aprendizados aplicáveis ao BEV" texto={bench.aprendizados} />
        </div>
      )}
    </div>
  )
}

// ============================================================
// Página
// ============================================================
function BenchsPage() {
  const { cycle } = useApp()
  const { subareaIds } = useContextScope()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | B.BenchTipo>('todos')
  const qc = useQueryClient()

  const benchsQ = useQuery({
    queryKey: ['benchs', cycle.id, subareaIds?.join(',') ?? 'all'],
    queryFn: () => B.getBenchs(cycle.id, subareaIds),
  })

  const benchs = useMemo(() => benchsQ.data ?? [], [benchsQ.data])
  const visiveis = filtro === 'todos' ? benchs : benchs.filter((b) => b.tipo === filtro)
  const selected = benchs.find((b) => b.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Sparkles className="size-4.5" />
            </span>
            Benchs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Registro dos benchmarks realizados · Ciclo {cycle.nome}
          </p>
        </div>
        <NovoBenchDialog onCriado={() => qc.invalidateQueries({ queryKey: ['benchs'] })} />
      </header>

      {benchsQ.isPending ? (
        <Skeleton className="mb-4 h-40 w-full" />
      ) : (
        <div className="mb-4 flex flex-col gap-4">
          <ProgressoNivel benchs={benchs} />
          <Conquistas benchs={benchs} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['todos', ...B.TIPOS] as Array<'todos' | B.BenchTipo>).map((t) => {
          const ativo = filtro === t
          const qtd = t === 'todos' ? benchs.length : benchs.filter((b) => b.tipo === t).length
          return (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                ativo ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent/50',
              )}
            >
              {t === 'todos' ? 'Todos' : B.TIPO_LABELS[t]} ({qtd})
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-2 lg:col-span-2">
          {benchsQ.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : visiveis.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-center text-sm">
                Nenhum bench registrado ainda. Registre o primeiro e comece a pontuar.
              </CardContent>
            </Card>
          ) : (
            visiveis.map((b) => {
              const orgs = B.organizacoesDistintas(b)
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={cn(
                    'rounded-xl border p-3.5 text-left transition-colors',
                    selectedId === b.id ? 'bg-accent border-ring' : 'bg-card hover:bg-accent/50',
                  )}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant={TIPO_VARIANT[b.tipo]} className="text-[10px]">
                      {B.TIPO_LABELS[b.tipo]}
                    </Badge>
                    {orgs.length > 1 && (
                      <Badge variant="success" className="text-[10px]">
                        {orgs.length} EJs
                      </Badge>
                    )}
                    {B.isDocumentado(b) ? (
                      <Badge variant="success" className="ml-auto text-[10px]">
                        +{B.pontosDoBench(b)} pts
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="ml-auto text-[10px]">
                        documentar
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium">{b.tema || 'Sem tema'}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {fmtDate(b.data)} ·{' '}
                    {b.participantes.length > 0
                      ? b.participantes.map((p) => p.nome).join(', ')
                      : (b.membro_nome ?? 'sem participantes')}
                  </p>
                </button>
              )
            })
          )}
        </div>
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-5">
              {selected ? (
                <BenchDetail key={selected.id} bench={selected} />
              ) : (
                <p className="text-muted-foreground p-6 text-center text-sm">
                  Selecione um bench para ver e registrar os insights.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
