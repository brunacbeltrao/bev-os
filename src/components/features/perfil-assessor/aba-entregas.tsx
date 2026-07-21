/**
 * Aba 1 — Entregas e Competências (PRD §5).
 * Resumo automático das demandas do ciclo + entregas avulsas +
 * tabela de faróis com o alerta de divergência de percepção (360°).
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListChecks,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { getCompetencies } from '@/lib/pdi'
import { fmtDate } from '@/lib/use-context-scope'
import {
  addEntregaAvulsa,
  CLASSE_FAROL,
  CLASSE_LABEL,
  FAROL_DOT,
  FAROL_LABEL,
  getEntregasAvulsas,
  getFaroles,
  getPerfilDemandas,
  MESES,
  removeEntregaAvulsa,
  setFarol,
  type ClasseEntrega,
  type Farol,
} from '@/lib/perfil-assessor'

const CLASSES: ClasseEntrega[] = ['no_prazo', 'com_atraso', 'em_aberto']
const FAROIS: Farol[] = ['verde', 'amarelo', 'vermelho']

export function AbaEntregas({
  personId,
  cycleId,
  cicloNome,
  subareaId,
  authorId,
  podeEditar,
  ehOProprio,
}: {
  personId: string
  cycleId: string
  cicloNome: string
  subareaId: string | null
  authorId: string
  /** Liderança da pessoa: edita faróis do gerente e entregas avulsas. */
  podeEditar: boolean
  /** A pessoa olhando o próprio perfil: preenche só a autoavaliação. */
  ehOProprio: boolean
}) {
  const qc = useQueryClient()
  const [painel, setPainel] = useState<ClasseEntrega | null>(null)
  const [novaAberta, setNovaAberta] = useState(false)

  const hoje = new Date()
  const [ref, setRef] = useState({ mes: hoje.getMonth() + 1, ano: hoje.getFullYear() })

  const demandasQ = useQuery({
    queryKey: ['perfil-demandas', personId, cycleId],
    queryFn: () => getPerfilDemandas(personId, cycleId),
  })
  const avulsasQ = useQuery({
    queryKey: ['perfil-avulsas', personId, cycleId],
    queryFn: () => getEntregasAvulsas(personId, cycleId),
  })
  const compsQ = useQuery({
    queryKey: ['competencies', subareaId],
    queryFn: () => getCompetencies(subareaId),
  })
  const faroisQ = useQuery({
    queryKey: ['perfil-faroles', personId, cycleId, ref.mes, ref.ano],
    queryFn: () => getFaroles(personId, cycleId, ref.mes, ref.ano),
  })

  const demandas = demandasQ.data ?? []
  const avulsas = avulsasQ.data ?? []

  const contagem = useMemo(() => {
    const base: Record<ClasseEntrega, number> = { no_prazo: 0, com_atraso: 0, em_aberto: 0 }
    for (const d of demandas) base[d.classe] += 1
    for (const e of avulsas) {
      if (e.qualidade === 'verde') base.no_prazo += 1
      else if (e.qualidade === 'amarelo') base.com_atraso += 1
      else base.em_aberto += 1
    }
    return base
  }, [demandas, avulsas])

  const total = contagem.no_prazo + contagem.com_atraso + contagem.em_aberto

  const farolMut = useMutation({
    mutationFn: (v: { competency_id: string; campo: 'farol_lider' | 'farol_auto'; valor: Farol | null }) =>
      setFarol({ person_id: personId, cycle_id: cycleId, mes: ref.mes, ano: ref.ano, ...v }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['perfil-faroles', personId, cycleId, ref.mes, ref.ano] }),
  })

  const removerMut = useMutation({
    mutationFn: removeEntregaAvulsa,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfil-avulsas', personId, cycleId] }),
  })

  const farolDe = (competencyId: string) =>
    (faroisQ.data ?? []).find((f) => f.competency_id === competencyId)

  function mudarMes(delta: number) {
    setRef((r) => {
      const d = new Date(r.ano, r.mes - 1 + delta, 1)
      return { mes: d.getMonth() + 1, ano: d.getFullYear() }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Resumo de entregas ---------- */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="size-4" />
                Entregas do ciclo {cicloNome}
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {total === 0
                  ? 'Nenhuma entrega registrada ainda'
                  : `${total} ${total === 1 ? 'entrega' : 'entregas'} · clique num número para ver a lista`}
              </p>
            </div>
            {podeEditar && (
              <Button size="sm" variant="outline" onClick={() => setNovaAberta(true)}>
                <Plus className="size-4" />
                Entrega avulsa
              </Button>
            )}
          </div>

          {demandasQ.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CLASSES.map((c) => {
                const n = contagem[c]
                const pct = total === 0 ? 0 : Math.round((n / total) * 100)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => n > 0 && setPainel(c)}
                    disabled={n === 0}
                    className="bg-card hover:bg-accent/50 flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className={`size-2.5 shrink-0 rounded-full ${FAROL_DOT[CLASSE_FAROL[c]]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-2xl font-semibold tabular-nums leading-none">
                        {n}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-xs">
                        {CLASSE_LABEL[c]} · {pct}%
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {avulsas.length > 0 && (
            <div className="mt-4 border-t pt-3.5">
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                Entregas avulsas ({avulsas.length})
              </p>
              <ul className="flex flex-col gap-1.5">
                {avulsas.map((e) => (
                  <li key={e.id} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${FAROL_DOT[e.qualidade]}`}
                      title={FAROL_LABEL[e.qualidade]}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{e.titulo}</span>
                      <span className="text-muted-foreground"> · {fmtDate(e.data)}</span>
                      {e.observacao && (
                        <span className="text-muted-foreground block text-xs">{e.observacao}</span>
                      )}
                    </span>
                    {podeEditar && (
                      <button
                        type="button"
                        aria-label="Remover entrega avulsa"
                        onClick={() => removerMut.mutate(e.id)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Competências ---------- */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4" />
                Competências
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {ehOProprio
                  ? 'Marque como você se enxerga; a coluna da liderança é só leitura.'
                  : podeEditar
                    ? 'Marque o farol do mês. Onde a percepção divergir, o sistema avisa.'
                    : 'Visão de leitura.'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="size-7" aria-label="Mês anterior" onClick={() => mudarMes(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="w-32 text-center text-xs font-medium capitalize">
                {MESES[ref.mes - 1]} {ref.ano}
              </span>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Próximo mês" onClick={() => mudarMes(1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {compsQ.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : (compsQ.data ?? []).length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nenhuma competência cadastrada"
              description="A P&C define a lista de competências do ciclo na área de administração."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
                    <th className="pb-2 pr-3 font-medium">Competência</th>
                    <th className="pb-2 px-3 font-medium">Liderança</th>
                    <th className="pb-2 px-3 font-medium">Autoavaliação</th>
                    <th className="pb-2 pl-3 font-medium">Sinal</th>
                  </tr>
                </thead>
                <tbody>
                  {(compsQ.data ?? []).map((c) => {
                    const f = farolDe(c.id)
                    const divergente =
                      !!f?.farol_lider && !!f?.farol_auto && f.farol_lider !== f.farol_auto
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <span className="font-medium">{c.nome}</span>
                          <span className="text-muted-foreground block text-xs capitalize">
                            {c.categoria}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <FarolPicker
                            valor={f?.farol_lider ?? null}
                            editavel={podeEditar}
                            onChange={(valor) =>
                              farolMut.mutate({ competency_id: c.id, campo: 'farol_lider', valor })
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <FarolPicker
                            valor={f?.farol_auto ?? null}
                            editavel={ehOProprio}
                            onChange={(valor) =>
                              farolMut.mutate({ competency_id: c.id, campo: 'farol_auto', valor })
                            }
                          />
                        </td>
                        <td className="py-2.5 pl-3">
                          {divergente ? (
                            <span
                              className="text-status-warning inline-flex items-center gap-1 text-xs font-medium"
                              title={`A liderança avaliou como "${FAROL_LABEL[f!.farol_lider!]}" e a pessoa se avaliou como "${FAROL_LABEL[f!.farol_auto!]}". Vale explorar isso na próxima 1:1.`}
                            >
                              <AlertTriangle className="size-3.5" />
                              Divergência
                            </span>
                          ) : f?.farol_lider && f?.farol_auto ? (
                            <span className="text-status-success inline-flex items-center gap-1 text-xs">
                              <CheckCircle2 className="size-3.5" />
                              Alinhado
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Painel lateral com a lista de demandas ---------- */}
      <Sheet open={painel !== null} onOpenChange={(o) => !o && setPainel(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{painel ? CLASSE_LABEL[painel] : ''}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2 overflow-y-auto">
            {demandas
              .filter((d) => d.classe === painel)
              .map((d) => (
                <div key={d.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{d.titulo}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {d.prazo ? `Prazo ${fmtDate(d.prazo)}` : 'Sem prazo'} · {d.status}
                  </p>
                </div>
              ))}
            {avulsas
              .filter((e) => painel && CLASSE_FAROL[painel] === e.qualidade)
              .map((e) => (
                <div key={e.id} className="rounded-lg border border-dashed p-3">
                  <p className="text-sm font-medium">{e.titulo}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {fmtDate(e.data)} · entrega avulsa
                  </p>
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>

      <NovaEntregaAvulsaDialog
        aberta={novaAberta}
        onFechar={() => setNovaAberta(false)}
        personId={personId}
        cycleId={cycleId}
        authorId={authorId}
      />
    </div>
  )
}

function FarolPicker({
  valor,
  editavel,
  onChange,
}: {
  valor: Farol | null
  editavel: boolean
  onChange: (v: Farol | null) => void
}) {
  if (!editavel) {
    return valor ? (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className={`size-2.5 rounded-full ${FAROL_DOT[valor]}`} />
        {FAROL_LABEL[valor]}
      </span>
    ) : (
      <span className="text-muted-foreground text-xs">Não avaliado</span>
    )
  }
  return (
    <div className="flex items-center gap-1">
      {FAROIS.map((f) => (
        <button
          key={f}
          type="button"
          aria-label={FAROL_LABEL[f]}
          title={FAROL_LABEL[f]}
          onClick={() => onChange(valor === f ? null : f)}
          className={`size-5 rounded-full border-2 transition-all ${FAROL_DOT[f]} ${
            valor === f
              ? 'ring-ring scale-110 ring-2 ring-offset-1 border-transparent'
              : 'border-transparent opacity-30 hover:opacity-70'
          }`}
        />
      ))}
    </div>
  )
}

function NovaEntregaAvulsaDialog({
  aberta,
  onFechar,
  personId,
  cycleId,
  authorId,
}: {
  aberta: boolean
  onFechar: () => void
  personId: string
  cycleId: string
  authorId: string
}) {
  const qc = useQueryClient()
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [qualidade, setQualidade] = useState<Farol>('verde')
  const [observacao, setObservacao] = useState('')

  const mut = useMutation({
    mutationFn: () =>
      addEntregaAvulsa({
        person_id: personId,
        cycle_id: cycleId,
        autor_id: authorId,
        titulo: titulo.trim(),
        data,
        qualidade,
        observacao,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perfil-avulsas', personId, cycleId] })
      setTitulo('')
      setObservacao('')
      setQualidade('verde')
      onFechar()
    },
  })

  return (
    <Dialog open={aberta} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar entrega avulsa</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (titulo.trim()) mut.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ea-titulo">O que foi entregue</Label>
            <Input
              id="ea-titulo"
              maxLength={120}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: apresentou o case do cliente na RA"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ea-data">Data</Label>
            <Input id="ea-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Qualidade</Label>
            <div className="flex flex-wrap gap-2">
              {FAROIS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setQualidade(f)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    qualidade === f ? 'border-ring bg-accent' : 'hover:bg-accent/50'
                  }`}
                >
                  <span className={`size-2.5 rounded-full ${FAROL_DOT[f]}`} />
                  {f === 'verde' ? 'Excelente' : f === 'amarelo' ? 'Boa' : 'Requer revisão'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ea-obs">Observação (opcional)</Label>
            <Textarea
              id="ea-obs"
              maxLength={280}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Uma linha de contexto"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!titulo.trim() || mut.isPending}>
              Registrar
            </Button>
          </div>
          {mut.isError && (
            <p className="text-destructive flex items-center gap-1.5 text-xs">
              <Clock className="size-3.5" />
              Não foi possível registrar. Tente novamente.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
