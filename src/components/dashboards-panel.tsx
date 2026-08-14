/**
 * Painel de indicadores por diretoria (2026.2). Visível a todos os
 * membros; cada diretoria edita a própria seção (o RLS garante a
 * permissão; aqui só decidimos mostrar ou não o botão de editar).
 * Reutilizado na página Dashboards e na Visão Geral BEV.
 */
import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase,
  Building2,
  FileSignature,
  Handshake,
  HeartHandshake,
  Pencil,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
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
import { useConfirm } from '@/components/ui/confirm-dialog'
import { useApp } from '@/lib/app-context'
import { fmtBRL } from '@/lib/financeiro'
import { MiniLineChart, type LinePoint } from '@/components/mini-line-chart'
import * as D from '@/lib/dashboards'
import * as C from '@/lib/contratos'
import * as CL from '@/lib/colab'
import { getDirectory } from '@/lib/org'
import { canEditDirectorate } from '@/lib/permissions'
import { cn } from '@/lib/utils'

/** Select nativo com o mesmo visual dos inputs do sistema. */
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

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const pctLabel = (frac: number) => `${Math.round(frac * 100)}%`
const num = (s: string) => {
  const v = parseFloat(s)
  return isNaN(v) ? 0 : v
}

function Bar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
      <div className="bg-primary h-full rounded-full" style={{ width: `${w}%` }} />
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  edit,
  children,
}: {
  icon: typeof Users
  title: string
  edit?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Icon className="size-4" />
          <h3 className="text-base font-semibold">{title}</h3>
          {edit && <div className="ml-auto">{edit}</div>}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

/** Dialog de edição genérico. `onSave` é assíncrono; fecha só no sucesso. */
function EditDialog({
  title,
  onSave,
  children,
}: {
  title: string
  onSave: () => Promise<void>
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErro(null)
    try {
      await onSave()
      setOpen(false)
    } catch {
      setErro('Não foi possível salvar. Verifique se você tem permissão nesta diretoria.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Editar indicadores">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto" onSubmit={submit}>
          {children}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

// ============================================================
// Faixa geral BEV (Portal BJ) — CSAT (Direx)
// ============================================================
function GeralSection() {
  const { cycle, isDirex } = useApp()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['bev-ind', cycle.id], queryFn: () => D.getBevInd(cycle.id) })
  const [csat, setCsat] = useState('')

  const edit = isDirex && q.data && (
    <EditDialog
      title="Indicadores gerais BEV"
      onSave={async () => {
        await D.saveBevInd(cycle.id, { csat: csat === '' ? q.data!.csat : num(csat) })
        qc.invalidateQueries({ queryKey: ['bev-ind', cycle.id] })
      }}
    >
      <Field label="CSAT (satisfação do cliente)">
        <Input type="number" step="0.1" defaultValue={q.data?.csat ?? ''} onChange={(e) => setCsat(e.target.value)} placeholder="Ex.: 8.7" />
      </Field>
    </EditDialog>
  )

  return (
    <SectionCard icon={Target} title="Indicadores gerais BEV · Portal BJ" edit={edit}>
      {q.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        <div>
          <p className="text-2xl font-semibold">{q.data?.csat != null ? q.data.csat : '—'}</p>
          <p className="text-muted-foreground text-xs">CSAT · satisfação do cliente</p>
        </div>
      )}
    </SectionCard>
  )
}

// ============================================================
// Negócios — Faturamento vs meta BJ + ticket médio + conversão
// ============================================================
function ContratosDialog({ ano }: { ano: number }) {
  const confirmar = useConfirm()
  const { person, cycle } = useApp()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [cliente, setCliente] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [segmento, setSegmento] = useState<C.ContratoSegmento>('pme')
  const [obs, setObs] = useState('')

  const contratosQ = useQuery({
    queryKey: ['contratos', ano],
    queryFn: () => C.getContratos(ano),
    enabled: open,
  })
  const servicosQ = useQuery({ queryKey: ['project-services'], queryFn: C.getServicos, enabled: open })
  const pessoasQ = useQuery({
    queryKey: ['directory-all', cycle.id],
    queryFn: () => getDirectory(cycle.id, null),
    enabled: open,
  })

  function limpar() {
    setCliente('')
    setValor('')
    setData('')
    setServicoId('')
    setResponsavelId('')
    setSegmento('pme')
    setObs('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!cliente.trim() || !valor || !data) return
    setSalvando(true)
    setErro(null)
    try {
      await C.createContrato(
        {
          cliente: cliente.trim(),
          valor: num(valor),
          data_fechamento: data,
          servico_id: servicoId || null,
          responsavel_id: responsavelId || null,
          segmento,
          observacoes: obs.trim() || null,
        },
        person.id,
      )
      limpar()
      qc.invalidateQueries({ queryKey: ['contratos', ano] })
      qc.invalidateQueries({ queryKey: ['fat-mensal', ano] })
    } catch {
      setErro('Não foi possível salvar o contrato. Confirme se você tem permissão em Negócios.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: string) {
    if (
      !(await confirmar({
        titulo: 'Excluir este contrato?',
        descricao: 'O faturamento do ano será recalculado.',
        destrutivo: true,
      }))
    )
      return
    try {
      await C.deleteContrato(id)
      qc.invalidateQueries({ queryKey: ['contratos', ano] })
      qc.invalidateQueries({ queryKey: ['fat-mensal', ano] })
    } catch {
      setErro('Não foi possível excluir o contrato.')
    }
  }

  const contratos = contratosQ.data ?? []
  const total = contratos.reduce((s, c) => s + Number(c.valor), 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileSignature className="size-4" />
          Contratos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contratos fechados · {ano}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <form className="grid grid-cols-2 gap-3 rounded-lg border p-3" onSubmit={submit}>
            <div className="col-span-2">
              <Field label="Cliente">
                <Input required value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
              </Field>
            </div>
            <Field label="Valor (R$)">
              <Input required type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
            </Field>
            <Field label="Data de fechamento">
              <Input required type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
            <Field label="Serviço">
              <Select value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
                <option value="">— não informado —</option>
                {(servicosQ.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Segmento">
              <Select value={segmento} onChange={(e) => setSegmento(e.target.value as C.ContratoSegmento)}>
                {Object.entries(C.SEGMENTO_CONTRATO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label="Responsável pelo fechamento">
                <Select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)}>
                  <option value="">— não informado —</option>
                  {(pessoasQ.data ?? []).map((d) => (
                    <option key={d.person.id} value={d.person.id}>
                      {d.person.nome}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Observações">
                <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
              </Field>
            </div>
            {erro && <p className="col-span-2 text-sm text-red-600">{erro}</p>}
            <div className="col-span-2">
              <Button type="submit" disabled={salvando} className="w-full">
                {salvando ? 'Salvando…' : 'Registrar contrato'}
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {contratos.length} contrato{contratos.length === 1 ? '' : 's'} em {ano}
              </p>
              <p className="text-sm font-semibold">{fmtBRL(total)}</p>
            </div>
            {contratosQ.isPending ? (
              <Skeleton className="h-20 w-full" />
            ) : contratos.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Nenhum contrato registrado ainda.
              </p>
            ) : (
              contratos.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.cliente}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(c.data_fechamento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {c.servico ? ` · ${c.servico.nome}` : ''}
                      {c.responsavel ? ` · ${c.responsavel.nome}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary">{C.SEGMENTO_CONTRATO_LABELS[c.segmento]}</Badge>
                  <span className="font-semibold">{fmtBRL(Number(c.valor))}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir contrato"
                    onClick={() => remover(c.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NegociosSection({ canEdit }: { canEdit: boolean }) {
  const { cycle } = useApp()
  const anoBj = Number(cycle.nome.split('.')[0]) || new Date().getFullYear()
  const qc = useQueryClient()
  const fatQ = useQuery({ queryKey: ['fat-mensal', anoBj], queryFn: () => D.getFaturamentoMensal(anoBj) })
  const negQ = useQuery({ queryKey: ['dash-negocios'], queryFn: D.getDashNegocios })
  const indQ = useQuery({ queryKey: ['neg-ind', cycle.id], queryFn: () => D.getNegInd(cycle.id) })

  const fat = fatQ.data ?? []
  const points: LinePoint[] = fat.map((f) => ({ label: MESES[f.mes - 1], meta: f.meta, realizado: f.realizado }))
  const realizados = fat.filter((f) => f.realizado != null)
  const realizadoAtual = realizados.length ? (realizados[realizados.length - 1].realizado as number) : 0
  const metaAnual = fat.length ? fat[fat.length - 1].meta : 84036.5
  const mesAtual = Math.min(new Date().getMonth() + 1, 12)
  const metaMes = fat.find((f) => f.mes === mesAtual)?.meta ?? 0
  const gap = realizadoAtual - metaMes
  const usandoContratos = fat.some((f) => f.realizado_manual == null && f.realizado_contratos > 0)

  const [real, setReal] = useState<Record<number, string>>({})
  const [meta, setMeta] = useState<Record<number, string>>({})
  const [ticketMeta, setTicketMeta] = useState('')
  const [convMeta, setConvMeta] = useState('')

  const edit = canEdit && fatQ.data && indQ.data && (
    <EditDialog
      title="Editar indicadores de Negócios"
      onSave={async () => {
        for (const [mesStr, val] of Object.entries(real)) {
          await D.setFaturamentoRealizado(anoBj, Number(mesStr), val === '' ? null : num(val))
        }
        for (const [mesStr, val] of Object.entries(meta)) {
          if (val !== '') await D.setFaturamentoMeta(anoBj, Number(mesStr), num(val))
        }
        await D.saveNegInd(cycle.id, {
          ticket_medio_meta: ticketMeta === '' ? indQ.data!.ticket_medio_meta : num(ticketMeta),
          conversao_meta: convMeta === '' ? indQ.data!.conversao_meta : num(convMeta) / 100,
        })
        qc.invalidateQueries({ queryKey: ['fat-mensal', anoBj] })
        qc.invalidateQueries({ queryKey: ['neg-ind', cycle.id] })
      }}
    >
      <p className="text-muted-foreground text-xs">
        O realizado é calculado automaticamente somando os contratos fechados do ano. Preencha
        abaixo só se precisar sobrescrever com o número oficial da Brasil Júnior — deixe em branco
        para voltar ao automático.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {fat.map((f) => (
          <div key={f.mes} className="flex flex-col gap-1">
            <Label className="text-xs">
              {MESES[f.mes - 1]}
              <span className="text-muted-foreground ml-1 font-normal">
                ({fmtBRL(f.realizado_contratos)})
              </span>
            </Label>
            <Input
              type="number"
              step="0.01"
              placeholder="automático"
              defaultValue={f.realizado_manual ?? ''}
              onChange={(e) => setReal((r) => ({ ...r, [f.mes]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">Meta acumulada por mês (R$) — Brasil Júnior</p>
      <div className="grid grid-cols-3 gap-2">
        {fat.map((f) => (
          <div key={f.mes} className="flex flex-col gap-1">
            <Label className="text-xs">{MESES[f.mes - 1]}</Label>
            <Input
              type="number"
              step="0.01"
              defaultValue={f.meta}
              onChange={(e) => setMeta((r) => ({ ...r, [f.mes]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Field label="Meta de ticket médio (R$)">
        <Input type="number" step="0.01" defaultValue={indQ.data?.ticket_medio_meta} onChange={(e) => setTicketMeta(e.target.value)} />
      </Field>
      <Field label="Meta de conversão do funil (%)">
        <Input type="number" step="1" defaultValue={Math.round((indQ.data?.conversao_meta ?? 0) * 100)} onChange={(e) => setConvMeta(e.target.value)} />
      </Field>
    </EditDialog>
  )

  const acoes = canEdit && (
    <div className="flex items-center gap-1">
      <ContratosDialog ano={anoBj} />
      {edit}
    </div>
  )

  return (
    <SectionCard icon={TrendingUp} title="Negócios · Faturamento (Brasil Júnior)" edit={acoes}>
      {fatQ.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-semibold">{fmtBRL(realizadoAtual)}</p>
              <p className="text-muted-foreground text-xs">
                de {fmtBRL(metaAnual)} · {pctLabel(metaAnual > 0 ? realizadoAtual / metaAnual : 0)} da meta anual
              </p>
            </div>
            <Badge variant={gap >= 0 ? 'success' : 'danger'}>
              {gap >= 0 ? '+' : ''}
              {fmtBRL(gap)} vs meta de {MESES[mesAtual - 1]}
            </Badge>
          </div>
          <MiniLineChart points={points} />
          <p className="text-muted-foreground text-xs">
            {usandoContratos
              ? 'Realizado calculado a partir dos contratos fechados registrados.'
              : 'Realizado com ajuste manual. Registre os contratos para o cálculo automático.'}
          </p>
        </>
      )}

      <div className="mt-1 grid grid-cols-2 gap-3">
        <div className="bg-card rounded-lg border p-2.5">
          <p className="text-lg font-semibold">{negQ.data ? fmtBRL(negQ.data.ticket_medio) : '—'}</p>
          <p className="text-muted-foreground text-xs">
            Ticket médio {indQ.data ? `· meta ${fmtBRL(indQ.data.ticket_medio_meta)}` : ''}
          </p>
        </div>
        <div className="bg-card rounded-lg border p-2.5">
          <p className="text-lg font-semibold">{negQ.data ? pctLabel(negQ.data.conversao) : '—'}</p>
          <p className="text-muted-foreground text-xs">
            Conversão {indQ.data ? `· meta ${pctLabel(indQ.data.conversao_meta)}` : ''}
            {negQ.data ? ` (${negQ.data.fechados}/${negQ.data.total})` : ''}
          </p>
        </div>
      </div>
    </SectionCard>
  )
}

// ============================================================
// Projetos — em andamento por serviço e por núcleo
// ============================================================
function BreakdownList({ rows }: { rows: D.BreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total))
  const visiveis = rows.filter((r) => r.total > 0)
  if (visiveis.length === 0) return <p className="text-muted-foreground text-sm">Nenhum projeto classificado.</p>
  return (
    <div className="flex flex-col gap-2">
      {visiveis.map((r) => (
        <div key={r.nome}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{r.nome}</span>
            <span className="font-medium">{r.total}</span>
          </div>
          <Bar value={r.total} max={max} />
        </div>
      ))}
    </div>
  )
}

function ProjetosSection() {
  const resumoQ = useQuery({ queryKey: ['dash-proj-resumo'], queryFn: D.getDashProjResumo })
  const servQ = useQuery({ queryKey: ['dash-proj-servico'], queryFn: D.getDashProjServico })
  const nucQ = useQuery({ queryKey: ['dash-proj-nucleo'], queryFn: D.getDashProjNucleo })

  return (
    <SectionCard icon={Briefcase} title="Projetos · em andamento">
      {resumoQ.isPending ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <p className="text-2xl font-semibold">
          {resumoQ.data?.total ?? 0}
          <span className="text-muted-foreground ml-1 text-sm font-normal">projetos em andamento</span>
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">Por serviço</p>
          {servQ.isPending ? <Skeleton className="h-24 w-full" /> : <BreakdownList rows={servQ.data ?? []} />}
        </div>
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">Por núcleo</p>
          {nucQ.isPending ? <Skeleton className="h-24 w-full" /> : <BreakdownList rows={nucQ.data ?? []} />}
        </div>
      </div>
      {resumoQ.data && resumoQ.data.sem_servico > 0 && (
        <p className="text-muted-foreground text-xs">{resumoQ.data.sem_servico} projeto(s) sem serviço definido.</p>
      )}
    </SectionCard>
  )
}

// ============================================================
// Gestão — caixa e saúde financeira
// ============================================================
function GestaoSection({ canEdit }: { canEdit: boolean }) {
  const { cycle } = useApp()
  const qc = useQueryClient()
  const finQ = useQuery({ queryKey: ['dash-financeiro'], queryFn: D.getDashFinanceiro })
  const metaQ = useQuery({ queryKey: ['fin-meta', cycle.id], queryFn: () => D.getFinMeta(cycle.id) })
  const [reserva, setReserva] = useState('')

  const saldo = finQ.data?.saldo ?? 0
  const reservaMin = metaQ.data?.reserva_minima ?? 0
  const saudavel = saldo >= reservaMin && saldo > 0

  const edit = canEdit && metaQ.data && (
    <EditDialog
      title="Editar meta de caixa (Gestão)"
      onSave={async () => {
        await D.saveFinMeta(cycle.id, { reserva_minima: reserva === '' ? metaQ.data!.reserva_minima : num(reserva) })
        qc.invalidateQueries({ queryKey: ['fin-meta', cycle.id] })
      }}
    >
      <Field label="Reserva mínima de caixa (R$)">
        <Input type="number" step="0.01" defaultValue={metaQ.data?.reserva_minima} onChange={(e) => setReserva(e.target.value)} />
      </Field>
    </EditDialog>
  )

  return (
    <SectionCard icon={Wallet} title="Gestão · Caixa e saúde financeira" edit={edit}>
      {finQ.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <p className="text-2xl font-semibold">{fmtBRL(saldo)}</p>
            <Badge variant={saudavel ? 'success' : 'warning'}>{saudavel ? 'Saudável' : 'Atenção'}</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-emerald-600">Entradas</span>
            <span className="font-medium">{fmtBRL(finQ.data?.entradas ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-red-600">Saídas</span>
            <span className="font-medium">{fmtBRL(finQ.data?.saidas ?? 0)}</span>
          </div>
          {reservaMin > 0 && (
            <p className="text-muted-foreground text-xs">Reserva mínima definida: {fmtBRL(reservaMin)}</p>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ============================================================
// Pessoas e Cultura — PDIs + Clima (eNPS)
// ============================================================
function PcSection({ canEdit }: { canEdit: boolean }) {
  const { cycle } = useApp()
  const qc = useQueryClient()
  const pdiQ = useQuery({ queryKey: ['dash-pdi'], queryFn: D.getDashPdi })
  const indQ = useQuery({ queryKey: ['pc-ind', cycle.id], queryFn: () => D.getPcInd(cycle.id) })
  const [enps, setEnps] = useState('')

  const edit = canEdit && indQ.data && (
    <EditDialog
      title="Editar clima (P&C)"
      onSave={async () => {
        await D.savePcInd(cycle.id, { enps: enps === '' ? indQ.data!.enps : num(enps) })
        qc.invalidateQueries({ queryKey: ['pc-ind', cycle.id] })
      }}
    >
      <Field label="eNPS / Clima organizacional">
        <Input type="number" step="0.1" defaultValue={indQ.data?.enps ?? ''} onChange={(e) => setEnps(e.target.value)} placeholder="Ex.: 72" />
      </Field>
    </EditDialog>
  )

  return (
    <SectionCard icon={HeartHandshake} title="Pessoas e Cultura · PDIs e clima" edit={edit}>
      {pdiQ.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-2xl font-semibold">{pdiQ.data?.abertos ?? 0}</p>
            <p className="text-muted-foreground text-xs">PDIs abertos</p>
          </div>
          <div>
            <p className="text-emerald-600 text-2xl font-semibold">{pdiQ.data?.concluidos ?? 0}</p>
            <p className="text-muted-foreground text-xs">concluídos</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-red-600">{pdiQ.data?.em_risco ?? 0}</p>
            <p className="text-muted-foreground text-xs">em risco</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-2 text-sm">
        <span className="text-muted-foreground">Clima (eNPS)</span>
        <span className="text-lg font-semibold">{indQ.data?.enps != null ? indQ.data.enps : '—'}</span>
      </div>
    </SectionCard>
  )
}

// ============================================================
// Institucional — faturamento colaborativo + engajamento MEJ
// ============================================================
/** Registro de colaborações: serviço, EJ parceira, valor total e valor BEV. */
function ColabDialog() {
  const confirmar = useConfirm()
  const { person, cycle } = useApp()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const [servicoId, setServicoId] = useState('')
  const [servicoOutro, setServicoOutro] = useState('')
  const [ej, setEj] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [valorBev, setValorBev] = useState('')
  const [fechadoPor, setFechadoPor] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [obs, setObs] = useState('')

  const listaQ = useQuery({
    queryKey: ['colab-faturamentos', cycle.id],
    queryFn: () => CL.getColabFaturamentos(cycle.id),
    enabled: open,
  })
  const servicosQ = useQuery({ queryKey: ['project-services'], queryFn: C.getServicos, enabled: open })
  const pessoasQ = useQuery({
    queryKey: ['directory-all', cycle.id],
    queryFn: () => getDirectory(cycle.id, null),
    enabled: open,
  })

  function limpar() {
    setServicoId('')
    setServicoOutro('')
    setEj('')
    setValorTotal('')
    setValorBev('')
    setFechadoPor('')
    setObs('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ej.trim() || !valorTotal || !valorBev) return
    if (!servicoId && !servicoOutro.trim()) {
      setErro('Informe o tipo de serviço.')
      return
    }
    if (num(valorBev) > num(valorTotal)) {
      setErro('O valor do BEV não pode ser maior que o valor total do contrato.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      await CL.createColabFaturamento(
        {
          cycle_id: cycle.id,
          servico_id: servicoId || null,
          servico_outro: servicoId ? null : servicoOutro.trim(),
          ej_parceira: ej.trim(),
          valor_total: num(valorTotal),
          valor_bev: num(valorBev),
          fechado_por: fechadoPor || null,
          data_fechamento: data,
          observacoes: obs.trim() || null,
        },
        person.id,
      )
      limpar()
      qc.invalidateQueries({ queryKey: ['colab-faturamentos', cycle.id] })
    } catch {
      setErro('Não foi possível salvar. Confirme se você tem permissão em Institucional.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: string) {
    if (
      !(await confirmar({
        titulo: 'Excluir esta colaboração?',
        descricao: 'O faturamento do ciclo será recalculado.',
        destrutivo: true,
      }))
    )
      return
    try {
      await CL.deleteColabFaturamento(id)
      qc.invalidateQueries({ queryKey: ['colab-faturamentos', cycle.id] })
    } catch {
      setErro('Não foi possível excluir o lançamento.')
    }
  }

  const rows = listaQ.data ?? []
  const resumo = CL.resumirColab(rows)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Handshake className="size-4" />
          Colaborações
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Faturamento colaborativo · {cycle.nome}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
          <form className="grid grid-cols-2 gap-3 rounded-lg border p-3" onSubmit={submit}>
            <Field label="Tipo de serviço">
              <Select
                value={servicoId}
                onChange={(e) => {
                  setServicoId(e.target.value)
                  if (e.target.value) setServicoOutro('')
                }}
              >
                <option value="">— outro (descrever) —</option>
                {(servicosQ.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="EJ parceira">
              <Input required value={ej} onChange={(e) => setEj(e.target.value)} placeholder="Ex.: ACE Consultoria" />
            </Field>
            {!servicoId && (
              <div className="col-span-2">
                <Field label="Descreva o serviço">
                  <Input
                    required
                    value={servicoOutro}
                    onChange={(e) => setServicoOutro(e.target.value)}
                    placeholder="Ex.: Consultoria conjunta em compliance"
                  />
                </Field>
              </div>
            )}
            <Field label="Valor total do contrato (R$)">
              <Input required type="number" step="0.01" min="0" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
            </Field>
            <Field label="Valor para o BEV (R$)">
              <Input required type="number" step="0.01" min="0" value={valorBev} onChange={(e) => setValorBev(e.target.value)} />
            </Field>
            <Field label="Quem fechou">
              <Select value={fechadoPor} onChange={(e) => setFechadoPor(e.target.value)}>
                <option value="">— não informado —</option>
                {(pessoasQ.data ?? []).map((d) => (
                  <option key={d.person.id} value={d.person.id}>
                    {d.person.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data de fechamento">
              <Input required type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Field label="Observações">
                <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" />
              </Field>
            </div>
            {erro && <p className="col-span-2 text-sm text-red-600">{erro}</p>}
            <div className="col-span-2">
              <Button type="submit" disabled={salvando} className="w-full">
                {salvando ? 'Salvando…' : 'Registrar colaboração'}
              </Button>
            </div>
          </form>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {resumo.lancamentos} colaboraç{resumo.lancamentos === 1 ? 'ão' : 'ões'} ·{' '}
                {resumo.parceiros} parceir{resumo.parceiros === 1 ? 'o' : 'os'}
              </p>
              <p className="text-sm font-semibold">{fmtBRL(resumo.realizado)} p/ o BEV</p>
            </div>
            {listaQ.isPending ? (
              <Skeleton className="h-20 w-full" />
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Nenhuma colaboração registrada ainda.
              </p>
            ) : (
              rows.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.ej_parceira}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(c.data_fechamento + 'T12:00:00').toLocaleDateString('pt-BR')} ·{' '}
                      {CL.servicoLabel(c)}
                      {c.responsavel ? ` · ${c.responsavel.nome}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{fmtBRL(c.valor_bev)}</p>
                    <p className="text-muted-foreground text-xs">de {fmtBRL(c.valor_total)}</p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Excluir colaboração" onClick={() => remover(c.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InstitucionalSection({ canEdit }: { canEdit: boolean }) {
  const { cycle } = useApp()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['inst-ind', cycle.id], queryFn: () => D.getInstInd(cycle.id) })
  const colabQ = useQuery({
    queryKey: ['colab-faturamentos', cycle.id],
    queryFn: () => CL.getColabFaturamentos(cycle.id),
  })
  const [f, setF] = useState<Partial<D.InstInd>>({})

  const d = q.data
  const resumo = CL.resumirColab(colabQ.data ?? [])

  const dialogEdit = canEdit && d && (
    <EditDialog
      title="Editar metas de Institucional"
      onSave={async () => {
        await D.saveInstInd(cycle.id, {
          colab_realizado: d.colab_realizado,
          colab_meta: f.colab_meta ?? d.colab_meta,
          colab_ej: f.colab_ej ?? d.colab_ej,
          colab_ej_meta: f.colab_ej_meta ?? d.colab_ej_meta,
          colab_agentes: f.colab_agentes ?? d.colab_agentes,
          colab_agentes_meta: f.colab_agentes_meta ?? d.colab_agentes_meta,
          superavit: f.superavit ?? d.superavit,
          engajamento_mej: f.engajamento_mej ?? d.engajamento_mej,
        })
        qc.invalidateQueries({ queryKey: ['inst-ind', cycle.id] })
      }}
    >
      <p className="text-muted-foreground text-xs">
        O realizado do faturamento colaborativo é somado automaticamente a partir das colaborações
        registradas — use o botão “Colaborações” para lançar uma nova.
      </p>
      <Field label="Faturamento colaborativo — meta (R$)">
        <Input type="number" step="0.01" defaultValue={d?.colab_meta} onChange={(e) => setF((p) => ({ ...p, colab_meta: num(e.target.value) }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Meta de colaborações com EJ">
          <Input type="number" defaultValue={d?.colab_ej_meta} onChange={(e) => setF((p) => ({ ...p, colab_ej_meta: num(e.target.value) }))} />
        </Field>
        <Field label="Meta de agentes diferentes">
          <Input type="number" defaultValue={d?.colab_agentes_meta} onChange={(e) => setF((p) => ({ ...p, colab_agentes_meta: num(e.target.value) }))} />
        </Field>
      </div>
      <Field label="Superávit vs ano anterior (R$)">
        <Input type="number" step="0.01" defaultValue={d?.superavit} onChange={(e) => setF((p) => ({ ...p, superavit: num(e.target.value) }))} />
      </Field>
      <Field label="Engajamento MEJ (%)">
        <Input type="number" step="0.1" defaultValue={d?.engajamento_mej ?? ''} onChange={(e) => setF((p) => ({ ...p, engajamento_mej: num(e.target.value) }))} />
      </Field>
    </EditDialog>
  )

  const acoes = canEdit && (
    <div className="flex items-center gap-1">
      <ColabDialog />
      {dialogEdit}
    </div>
  )

  return (
    <SectionCard icon={Building2} title="Institucional · Colaborativo e MEJ" edit={acoes}>
      {q.isPending || !d ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Faturamento colaborativo</span>
              <span className="font-medium">
                {fmtBRL(resumo.realizado)} / {fmtBRL(d.colab_meta)} ·{' '}
                {pctLabel(d.colab_meta > 0 ? resumo.realizado / d.colab_meta : 0)}
              </span>
            </div>
            <Bar value={resumo.realizado} max={d.colab_meta} />
            <p className="text-muted-foreground mt-1 text-xs">
              Soma do valor que fica com o BEV em {resumo.lancamentos} colaboração
              {resumo.lancamentos === 1 ? '' : 'ões'} · {fmtBRL(resumo.valorContratado)} em contratos.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-lg font-semibold">
                {resumo.lancamentos}/{d.colab_ej_meta}
              </p>
              <p className="text-muted-foreground text-xs">colaborações</p>
            </div>
            <div>
              <p className="text-lg font-semibold">
                {resumo.parceiros}/{d.colab_agentes_meta}
              </p>
              <p className="text-muted-foreground text-xs">parceiros diferentes</p>
            </div>
            <div>
              <p className="text-lg font-semibold">{d.engajamento_mej != null ? `${d.engajamento_mej}%` : '—'}</p>
              <p className="text-muted-foreground text-xs">engajamento MEJ</p>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-sm">
            <span className="text-muted-foreground">Superávit vs ano anterior</span>
            <span className={`font-semibold ${d.superavit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {d.superavit >= 0 ? '▲ ' : '▼ '}
              {fmtBRL(d.superavit)}
            </span>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export function DashboardsPanel() {
  const { occupations } = useApp()
  const canEditDir = (slug: D.DirSlug) => canEditDirectorate(occupations, slug)

  return (
    <div className="flex flex-col gap-4">
      <GeralSection />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NegociosSection canEdit={canEditDir('negocios')} />
        <ProjetosSection />
        <GestaoSection canEdit={canEditDir('gestao')} />
        <PcSection canEdit={canEditDir('pessoas_cultura')} />
        <InstitucionalSection canEdit={canEditDir('institucional')} />
      </div>
    </div>
  )
}
