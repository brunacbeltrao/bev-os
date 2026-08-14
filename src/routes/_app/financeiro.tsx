/**
 * Financeiro (Onda 4) — caixa único institucional.
 *
 * Três abas:
 *  · Caixa       — saldo, resumo por categoria, lançamentos filtráveis e
 *                  exportáveis em CSV. Só lideranças de Gestão lançam,
 *                  excluem e ajustam o saldo inicial.
 *  · Solicitações— reembolsos e investimentos pedidos pelos membros; as
 *                  lideranças de Gestão aprovam ou rejeitam, podendo já
 *                  lançar a saída no caixa na mesma ação.
 *  · Minha solicitação — formulário do membro, com anexo de comprovante
 *                  obrigatório quando for reembolso.
 */
import { useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Download,
  FileUp,
  Inbox,
  Paperclip,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useApp } from '@/lib/app-context'
import { useAllSubareas, fmtDate } from '@/lib/use-context-scope'
import { isGestaoLideranca } from '@/lib/permissions'
import * as F from '@/lib/financeiro'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/financeiro')({ component: FinanceiroPage })

const { fmtBRL } = F

/** Select nativo com o visual dos inputs do sistema. */
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

type Aba = 'caixa' | 'solicitacoes' | 'minhas'

function FinanceiroPage() {
  const { person, cycle, occupations } = useApp()
  const podeGerir = isGestaoLideranca(occupations)
  const [aba, setAba] = useState<Aba>('caixa')

  const reqQ = useQuery({
    queryKey: ['finance-requests', cycle.id],
    queryFn: () => F.getFinanceRequests(cycle.id),
  })
  const pendentes = (reqQ.data ?? []).filter((r) => r.status === 'pendente')
  const minhas = (reqQ.data ?? []).filter((r) => r.solicitante_id === person.id)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        icon={Wallet}
        title="Financeiro"
        description={`Caixa único da EJ · Ciclo ${cycle.nome}`}
      />

      <div className="mb-5">
        <Segmented<Aba>
          value={aba}
          onChange={setAba}
          options={[
            { value: 'caixa', label: 'Caixa' },
            ...(podeGerir
              ? [
                  {
                    value: 'solicitacoes' as Aba,
                    label: 'Solicitações',
                    count: pendentes.length,
                  },
                ]
              : []),
            { value: 'minhas', label: 'Minhas solicitações', count: minhas.length },
          ]}
        />
      </div>

      {aba === 'caixa' && <CaixaTab podeGerir={podeGerir} />}
      {aba === 'solicitacoes' && podeGerir && <SolicitacoesTab />}
      {aba === 'minhas' && <MinhasTab />}
    </div>
  )
}

// ===========================================================================
// Caixa
// ===========================================================================

type FiltroTipo = 'todos' | F.FinanceTipo

function CaixaTab({ podeGerir }: { podeGerir: boolean }) {
  const confirmar = useConfirm()
  const { person, cycle } = useApp()
  const qc = useQueryClient()
  const subareasQ = useAllSubareas()

  const q = useQuery({
    queryKey: ['finance', cycle.id],
    queryFn: () => F.getFinanceEntries(cycle.id),
  })
  const metaQ = useQuery({
    queryKey: ['caixa-meta', cycle.id],
    queryFn: () => F.getCaixaMeta(cycle.id),
  })

  const todos = q.data ?? []
  const meta = metaQ.data ?? { saldo_inicial: 0, reserva_minima: 0 }

  // ---------- filtros ----------
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [categoria, setCategoria] = useState('')
  const [subarea, setSubarea] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [busca, setBusca] = useState('')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return todos.filter((e) => {
      if (tipo !== 'todos' && e.tipo !== tipo) return false
      if (categoria && e.categoria !== categoria) return false
      if (subarea && e.subarea_id !== subarea) return false
      if (de && e.data < de) return false
      if (ate && e.data > ate) return false
      if (termo && !e.descricao.toLowerCase().includes(termo)) return false
      return true
    })
  }, [todos, tipo, categoria, subarea, de, ate, busca])

  const filtroAtivo = tipo !== 'todos' || !!categoria || !!subarea || !!de || !!ate || !!busca

  const geral = F.summarize(todos, meta.saldo_inicial)
  const recorte = F.summarize(filtrados)
  const entradasPorCat = F.porCategoria(filtrados, 'entrada')
  const saidasPorCat = F.porCategoria(filtrados, 'saida')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['finance', cycle.id] })

  // ---------- novo lançamento ----------
  const [form, setForm] = useState({
    tipo: 'entrada' as F.FinanceTipo,
    valor: '',
    descricao: '',
    data: new Date().toISOString().slice(0, 10),
    categoria: 'contrato' as F.FinanceCategoria,
    subarea_id: '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const addMut = useMutation({
    mutationFn: () =>
      F.createFinanceEntry({
        tipo: form.tipo,
        valor: Number(form.valor.replace(',', '.')),
        descricao: form.descricao.trim(),
        data: form.data,
        categoria: form.categoria,
        subarea_id: form.subarea_id || null,
        aprovado_por: person.id,
      }),
    onSuccess: () => {
      setForm((f) => ({ ...f, valor: '', descricao: '' }))
      toast.success('Lançamento registrado.')
      invalidate()
    },
    onError: () => toast.error('Não foi possível lançar. Confirme se você é liderança de Gestão.'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => F.deleteFinanceEntry(id),
    onSuccess: () => {
      toast.success('Lançamento excluído.')
      invalidate()
    },
  })

  function limparFiltros() {
    setTipo('todos')
    setCategoria('')
    setSubarea('')
    setDe('')
    setAte('')
    setBusca('')
  }

  function exportar() {
    const nome = `bev-financeiro-${cycle.nome.replace(/[^\w.-]/g, '')}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
    F.baixarCsv(nome, F.entriesToCsv(filtrados))
    toast.success(`${filtrados.length} lançamento(s) exportado(s).`)
  }

  const saudavel = geral.saldo >= meta.reserva_minima && geral.saldo > 0

  return (
    <>
      {/* Saldo */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs font-medium">Saldo atual do caixa</p>
              <div className="mt-1 flex items-center gap-2">
                <p
                  className={cn(
                    'text-3xl font-bold tabular-nums tracking-tight',
                    geral.saldo < 0 && 'text-status-danger',
                  )}
                >
                  {q.isPending ? '—' : fmtBRL(geral.saldo)}
                </p>
                {!q.isPending && !metaQ.isPending && (
                  <Badge variant={saudavel ? 'success' : 'warning'}>
                    {saudavel ? 'Saudável' : 'Atenção'}
                  </Badge>
                )}
              </div>
              {meta.saldo_inicial !== 0 && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  inclui saldo inicial de {fmtBRL(meta.saldo_inicial)}
                </p>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-status-success flex items-center gap-1 text-xs font-medium">
                <ArrowUpRight className="size-3.5" /> Entradas
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{fmtBRL(geral.entradas)}</p>
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-status-danger flex items-center gap-1 text-xs font-medium">
                <ArrowDownRight className="size-3.5" /> Saídas
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{fmtBRL(geral.saidas)}</p>
            </div>
          </div>
          {podeGerir && (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <SaldoDialog meta={meta} />
              <Button size="sm" variant="outline" onClick={exportar} disabled={filtrados.length === 0}>
                <Download className="size-4" /> Exportar CSV
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Novo lançamento */}
      {podeGerir && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                if (form.descricao.trim() && Number(form.valor.replace(',', '.')) > 0) {
                  addMut.mutate()
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Tipo">
                  <div className="bg-muted flex h-9 items-center gap-0.5 rounded-lg p-0.5">
                    {(['entrada', 'saida'] as F.FinanceTipo[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          set('tipo', t)
                          set('categoria', F.CATEGORIAS_POR_TIPO[t][0])
                        }}
                        className={cn(
                          'flex-1 rounded-md px-2 py-1 text-sm font-medium transition-colors',
                          form.tipo === t
                            ? 'bg-card shadow-xs'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {t === 'entrada' ? 'Entrada' : 'Saída'}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Valor (R$)">
                  <Input
                    value={form.valor}
                    onChange={(e) => set('valor', e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Categoria">
                  <Select
                    value={form.categoria}
                    onChange={(e) => set('categoria', e.target.value)}
                  >
                    {F.CATEGORIAS_POR_TIPO[form.tipo].map((c) => (
                      <option key={c} value={c}>
                        {F.CATEGORIA_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Data">
                  <Input type="date" value={form.data} onChange={(e) => set('data', e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
                <Field label="Descrição">
                  <Input
                    value={form.descricao}
                    onChange={(e) => set('descricao', e.target.value)}
                    placeholder="Ex.: Contrato ACE Consultoria / Pagamento gráfica"
                  />
                </Field>
                <Field label="Área (opcional)">
                  <Select value={form.subarea_id} onChange={(e) => set('subarea_id', e.target.value)}>
                    <option value="">Geral</option>
                    {(subareasQ.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" disabled={addMut.isPending}>
                  <Plus className="size-4" /> Lançar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na descrição…"
            className="pl-8"
          />
        </div>
        <Segmented<FiltroTipo>
          value={tipo}
          onChange={setTipo}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'entrada', label: 'Entradas' },
            { value: 'saida', label: 'Saídas' },
          ]}
        />
        <Button
          variant={mostrarFiltros ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMostrarFiltros((v) => !v)}
        >
          <SlidersHorizontal className="size-4" /> Filtros
        </Button>
        {!podeGerir && (
          <Button variant="outline" size="sm" onClick={exportar} disabled={filtrados.length === 0}>
            <Download className="size-4" /> CSV
          </Button>
        )}
      </div>

      {mostrarFiltros && (
        <Card className="mb-3">
          <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <Field label="Categoria">
              <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(F.CATEGORIA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Área">
              <Select value={subarea} onChange={(e) => setSubarea(e.target.value)}>
                <option value="">Todas</option>
                {(subareasQ.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="De">
              <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </Field>
            <Field label="Até">
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </Field>
            {filtroAtivo && (
              <div className="col-span-2 sm:col-span-4">
                <Button variant="ghost" size="sm" onClick={limparFiltros}>
                  <X className="size-4" /> Limpar filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resumo por categoria */}
      {filtrados.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ResumoCategoria
            titulo="Entradas por categoria"
            linhas={entradasPorCat}
            total={recorte.entradas}
            tom="success"
          />
          <ResumoCategoria
            titulo="Saídas por categoria"
            linhas={saidasPorCat}
            total={recorte.saidas}
            tom="danger"
          />
        </div>
      )}

      {/* Lançamentos */}
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Lançamentos</h2>
        {filtroAtivo && !q.isPending && (
          <p className="text-muted-foreground text-xs">
            {filtrados.length} de {todos.length} · saldo do recorte{' '}
            <span className="font-medium tabular-nums">{fmtBRL(recorte.saldo)}</span>
          </p>
        )}
      </div>

      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : filtrados.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={filtroAtivo ? 'Nenhum lançamento no filtro' : 'Nenhum lançamento neste ciclo'}
          description={
            filtroAtivo
              ? 'Ajuste os filtros para ver outros períodos ou categorias.'
              : 'As entradas e saídas do caixa aparecem aqui assim que a Gestão registrar.'
          }
          action={
            filtroAtivo ? (
              <Button variant="outline" size="sm" onClick={limparFiltros}>
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map((e) => (
            <div key={e.id} className="bg-card flex items-center gap-3 rounded-lg border p-3">
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  e.tipo === 'entrada'
                    ? 'bg-status-success-bg text-status-success'
                    : 'bg-status-danger-bg text-status-danger',
                )}
              >
                {e.tipo === 'entrada' ? (
                  <ArrowUpRight className="size-4" />
                ) : (
                  <ArrowDownRight className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.descricao}</p>
                <p className="text-muted-foreground text-xs">
                  {fmtDate(e.data)}
                  {e.subarea?.nome && ` · ${e.subarea.nome}`}
                  {e.responsavel?.nome && ` · ${e.responsavel.nome}`}
                </p>
              </div>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {F.CATEGORIA_LABELS[e.categoria] ?? e.categoria}
              </Badge>
              {e.comprovante_url && (
                <a
                  href={e.comprovante_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  title="Ver comprovante"
                >
                  <Paperclip className="size-4" />
                </a>
              )}
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  e.tipo === 'entrada' ? 'text-status-success' : 'text-status-danger',
                )}
              >
                {e.tipo === 'entrada' ? '+' : '−'} {fmtBRL(e.valor)}
              </span>
              {podeGerir && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={async () => {
                    if (
                      await confirmar({
                        titulo: 'Excluir este lançamento?',
                        descricao: 'O saldo do caixa será recalculado.',
                        destrutivo: true,
                      })
                    )
                      delMut.mutate(e.id)
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function ResumoCategoria({
  titulo,
  linhas,
  total,
  tom,
}: {
  titulo: string
  linhas: Array<{ categoria: F.FinanceCategoria; total: number; qtd: number }>
  total: number
  tom: 'success' | 'danger'
}) {
  if (linhas.length === 0) return null
  const max = Math.max(...linhas.map((l) => l.total), 1)
  return (
    <Card>
      <CardContent className="flex flex-col gap-2.5 p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">{titulo}</h3>
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              tom === 'success' ? 'text-status-success' : 'text-status-danger',
            )}
          >
            {fmtBRL(total)}
          </span>
        </div>
        {linhas.map((l) => (
          <div key={l.categoria}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {F.CATEGORIA_LABELS[l.categoria]} · {l.qtd}
              </span>
              <span className="font-medium tabular-nums">{fmtBRL(l.total)}</span>
            </div>
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full rounded-full',
                  tom === 'success' ? 'bg-status-success' : 'bg-status-danger',
                )}
                style={{ width: `${Math.round((l.total / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/** Ajuste do saldo inicial e da reserva mínima do caixa. */
function SaldoDialog({ meta }: { meta: F.CaixaMeta }) {
  const { cycle } = useApp()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [saldo, setSaldo] = useState(String(meta.saldo_inicial))
  const [reserva, setReserva] = useState(String(meta.reserva_minima))

  const mut = useMutation({
    mutationFn: () =>
      F.saveCaixaMeta(cycle.id, {
        saldo_inicial: Number(saldo.replace(',', '.')) || 0,
        reserva_minima: Number(reserva.replace(',', '.')) || 0,
      }),
    onSuccess: () => {
      toast.success('Saldo do caixa atualizado.')
      setOpen(false)
      qc.invalidateQueries({ queryKey: ['caixa-meta', cycle.id] })
      qc.invalidateQueries({ queryKey: ['fin-meta', cycle.id] })
      qc.invalidateQueries({ queryKey: ['dash-financeiro'] })
    },
    onError: () => toast.error('Não foi possível atualizar o saldo.'),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Wallet className="size-4" /> Atualizar saldo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saldo do caixa · {cycle.nome}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            mut.mutate()
          }}
        >
          <p className="text-muted-foreground text-sm">
            O saldo exibido é o saldo inicial mais as entradas menos as saídas do ciclo. Use o saldo
            inicial para conciliar com o extrato bancário sem apagar lançamentos.
          </p>
          <Field label="Saldo inicial do ciclo (R$)">
            <Input value={saldo} onChange={(e) => setSaldo(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Reserva mínima de caixa (R$)">
            <Input value={reserva} onChange={(e) => setReserva(e.target.value)} inputMode="decimal" />
          </Field>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// Solicitações — visão das lideranças de Gestão
// ===========================================================================

function SolicitacoesTab() {
  const { person, cycle } = useApp()
  const qc = useQueryClient()
  const [filtro, setFiltro] = useState<'pendente' | 'todas'>('pendente')

  const q = useQuery({
    queryKey: ['finance-requests', cycle.id],
    queryFn: () => F.getFinanceRequests(cycle.id),
  })
  const todas = q.data ?? []
  const lista = filtro === 'pendente' ? todas.filter((r) => r.status === 'pendente') : todas

  const [aberta, setAberta] = useState<F.FinanceRequest | null>(null)
  const [resposta, setResposta] = useState('')
  const [lancar, setLancar] = useState(true)

  const mut = useMutation({
    mutationFn: (status: 'aprovado' | 'rejeitado') =>
      F.decideFinanceRequest({
        request: aberta!,
        status,
        avaliadoPor: person.id,
        resposta: resposta.trim() || null,
        lancarNoCaixa: status === 'aprovado' && lancar,
      }),
    onSuccess: (_d, status) => {
      toast.success(status === 'aprovado' ? 'Solicitação aprovada.' : 'Solicitação rejeitada.')
      setAberta(null)
      setResposta('')
      qc.invalidateQueries({ queryKey: ['finance-requests', cycle.id] })
      qc.invalidateQueries({ queryKey: ['finance', cycle.id] })
    },
    onError: () => toast.error('Não foi possível registrar a decisão.'),
  })

  return (
    <>
      <div className="mb-3">
        <Segmented<'pendente' | 'todas'>
          value={filtro}
          onChange={setFiltro}
          options={[
            {
              value: 'pendente',
              label: 'Pendentes',
              count: todas.filter((r) => r.status === 'pendente').length,
            },
            { value: 'todas', label: 'Todas', count: todas.length },
          ]}
        />
      </div>

      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhuma solicitação"
          description="Reembolsos e investimentos pedidos pelos membros aparecem aqui para análise."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{r.titulo}</p>
                    <Badge variant="secondary">{F.REQUEST_TIPO_LABELS[r.tipo]}</Badge>
                    <Badge variant={F.REQUEST_BADGE[r.status]}>{r.status}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {r.solicitante?.nome ?? 'Membro'} ·{' '}
                    {new Date(r.created_at).toLocaleDateString('pt-BR')} ·{' '}
                    {F.CATEGORIA_LABELS[r.categoria]}
                  </p>
                  {r.descricao && <p className="mt-1.5 text-sm">{r.descricao}</p>}
                  {r.resposta && (
                    <p className="text-muted-foreground mt-1 text-xs italic">
                      Resposta: {r.resposta}
                    </p>
                  )}
                </div>
                {r.comprovante_url && (
                  <a
                    href={r.comprovante_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                  >
                    <Paperclip className="size-3.5" /> Comprovante
                  </a>
                )}
                <span className="text-sm font-semibold tabular-nums">{fmtBRL(r.valor)}</span>
                {r.status === 'pendente' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setAberta(r)
                      setResposta('')
                      setLancar(true)
                    }}
                  >
                    Analisar
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {aberta ? `${F.REQUEST_TIPO_LABELS[aberta.tipo]} · ${aberta.titulo}` : ''}
            </DialogTitle>
          </DialogHeader>
          {aberta && (
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solicitante</span>
                  <span className="font-medium">{aberta.solicitante?.nome ?? '—'}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Valor</span>
                  <span className="font-semibold tabular-nums">{fmtBRL(aberta.valor)}</span>
                </div>
                {aberta.descricao && (
                  <p className="text-muted-foreground mt-2 text-xs">{aberta.descricao}</p>
                )}
                {aberta.comprovante_url && (
                  <a
                    href={aberta.comprovante_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary mt-2 inline-flex items-center gap-1 text-xs underline"
                  >
                    <Paperclip className="size-3.5" /> Abrir comprovante
                  </a>
                )}
              </div>
              <Field label="Resposta ao solicitante (opcional)">
                <Textarea
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  placeholder="Ex.: Aprovado, pagamento na próxima semana."
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={lancar}
                  onChange={(e) => setLancar(e.target.checked)}
                  className="size-4"
                />
                Lançar a saída no caixa ao aprovar
              </label>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={mut.isPending}
                  onClick={() => mut.mutate('aprovado')}
                >
                  <Check className="size-4" /> Aprovar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={mut.isPending}
                  onClick={() => mut.mutate('rejeitado')}
                >
                  <X className="size-4" /> Rejeitar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ===========================================================================
// Minhas solicitações — qualquer membro
// ===========================================================================

function MinhasTab() {
  const confirmar = useConfirm()
  const { person, cycle } = useApp()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const q = useQuery({
    queryKey: ['finance-requests', cycle.id],
    queryFn: () => F.getFinanceRequests(cycle.id),
  })
  const minhas = (q.data ?? []).filter((r) => r.solicitante_id === person.id)

  const [tipo, setTipo] = useState<F.RequestTipo>('reembolso')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [categoria, setCategoria] = useState<F.FinanceCategoria>('material')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)

  function limpar() {
    setTitulo('')
    setDescricao('')
    setValor('')
    setArquivo(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const v = Number(valor.replace(',', '.'))
    if (!titulo.trim() || !(v > 0)) return
    if (tipo === 'reembolso' && !arquivo) {
      toast.error('Anexe o comprovante para pedir reembolso.')
      return
    }
    setEnviando(true)
    try {
      const url = arquivo ? await F.uploadComprovante(arquivo, person.id) : null
      await F.createFinanceRequest({
        cycle_id: cycle.id,
        solicitante_id: person.id,
        tipo,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        valor: v,
        categoria,
        comprovante_url: url,
      })
      toast.success('Solicitação enviada às lideranças de Gestão.')
      limpar()
      qc.invalidateQueries({ queryKey: ['finance-requests', cycle.id] })
    } catch {
      toast.error('Não foi possível enviar a solicitação.')
    } finally {
      setEnviando(false)
    }
  }

  const cancelMut = useMutation({
    mutationFn: (id: string) => F.cancelFinanceRequest(id),
    onSuccess: () => {
      toast.success('Solicitação cancelada.')
      qc.invalidateQueries({ queryKey: ['finance-requests', cycle.id] })
    },
  })

  return (
    <>
      <Card className="mb-5">
        <CardContent className="p-4">
          <h2 className="mb-1 text-sm font-semibold">Pedir reembolso ou investimento</h2>
          <p className="text-muted-foreground mb-3 text-xs">
            A solicitação vai para as lideranças de Gestão, que aprovam ou rejeitam. Reembolso exige
            comprovante da despesa já paga; investimento é um gasto que ainda vai acontecer.
          </p>
          <form className="flex flex-col gap-3" onSubmit={enviar}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Tipo">
                <Select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as F.RequestTipo)}
                >
                  <option value="reembolso">Reembolso</option>
                  <option value="investimento">Investimento</option>
                </Select>
              </Field>
              <Field label="Valor (R$)">
                <Input
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Categoria">
                <Select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as F.FinanceCategoria)}
                >
                  {F.CATEGORIAS_POR_TIPO.saida
                    .filter((c) => c !== 'ajuste')
                    .map((c) => (
                      <option key={c} value={c}>
                        {F.CATEGORIA_LABELS[c]}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={tipo === 'reembolso' ? 'Comprovante *' : 'Comprovante (opcional)'}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  className="border-input bg-card file:bg-muted file:text-foreground h-9 w-full rounded-md border px-2 text-xs file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 file:text-xs"
                />
              </Field>
            </div>
            <Field label="Título">
              <Input
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Uber para reunião com cliente / Inscrição no ENEJ"
              />
            </Field>
            <Field label="Detalhes (opcional)">
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Contexto, data da despesa, iniciativa relacionada…"
              />
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={enviando} className="self-start">
                <FileUp className="size-4" />
                {enviando ? 'Enviando…' : 'Enviar solicitação'}
              </Button>
              {arquivo && (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Paperclip className="size-3.5" /> {arquivo.name}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <h2 className="mb-2 text-sm font-semibold">Histórico</h2>
      {q.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : minhas.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Você ainda não fez solicitações"
          description="Reembolsos e investimentos que você pedir aparecem aqui com o status da análise."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {minhas.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{r.titulo}</p>
                    <Badge variant="secondary">{F.REQUEST_TIPO_LABELS[r.tipo]}</Badge>
                    <Badge variant={F.REQUEST_BADGE[r.status]}>{r.status}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')} ·{' '}
                    {F.CATEGORIA_LABELS[r.categoria]}
                    {r.avaliador?.nome && ` · avaliado por ${r.avaliador.nome}`}
                  </p>
                  {r.resposta && (
                    <p className="text-muted-foreground mt-1 text-xs italic">{r.resposta}</p>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums">{fmtBRL(r.valor)}</span>
                {r.status === 'pendente' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={async () => {
                      if (
                        await confirmar({
                          titulo: 'Cancelar esta solicitação?',
                          confirmar: 'Cancelar solicitação',
                          cancelar: 'Voltar',
                          destrutivo: true,
                        })
                      )
                        cancelMut.mutate(r.id)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
