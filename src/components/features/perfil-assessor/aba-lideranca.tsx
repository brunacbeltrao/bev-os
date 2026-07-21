/**
 * Aba 2 — Diário de Liderança (PRD §6).
 * Uma linha do tempo única com 1:1, reconhecimentos e acompanhamentos
 * formais, separada por ciclo. É a memória qualitativa que sobrevive à
 * troca de gestão.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Flag,
  MessageSquare,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { FLAG_LABELS, type FlagCor } from '@/lib/warnings'
import { fmtDate } from '@/lib/use-context-scope'
import {
  addLeadershipEntry,
  getBandeira,
  getEventosProximos,
  getLeadershipEntries,
  MOTIVOS_ACOMPANHAMENTO,
  RECONHECIMENTOS,
  removeLeadershipEntry,
  TIPO_LABEL,
  type LeadershipEntry,
  type TipoInteracao,
} from '@/lib/perfil-assessor'

const ICONE: Record<TipoInteracao, typeof Star> = {
  one_on_one: MessageSquare,
  reconhecimento: Star,
  acompanhamento: TriangleAlert,
}
const COR: Record<TipoInteracao, string> = {
  one_on_one: 'bg-status-info-bg text-status-info',
  reconhecimento: 'bg-status-success-bg text-status-success',
  acompanhamento: 'bg-status-warning-bg text-status-warning',
}

export function AbaLideranca({
  personId,
  cycleId,
  authorId,
  podeEditar,
  primeiroNome,
}: {
  personId: string
  cycleId: string
  authorId: string
  podeEditar: boolean
  primeiroNome: string
}) {
  const qc = useQueryClient()
  const [modal, setModal] = useState<TipoInteracao | null>(null)
  const [escolhendo, setEscolhendo] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)

  const entriesQ = useQuery({
    queryKey: ['perfil-lideranca', personId],
    queryFn: () => getLeadershipEntries(personId),
  })
  const bandeiraQ = useQuery({
    queryKey: ['perfil-bandeira', personId, cycleId],
    queryFn: () => getBandeira(personId, cycleId),
  })

  const removerMut = useMutation({
    mutationFn: removeLeadershipEntry,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfil-lideranca', personId] }),
  })

  const porCiclo = useMemo(() => {
    const grupos = new Map<string, LeadershipEntry[]>()
    for (const e of entriesQ.data ?? []) {
      const k = e.ciclo?.nome ?? 'Sem ciclo'
      if (!grupos.has(k)) grupos.set(k, [])
      grupos.get(k)!.push(e)
    }
    return [...grupos.entries()]
  }, [entriesQ.data])

  const bandeira = bandeiraQ.data
  const mostrarBanner =
    bandeira && (bandeira.cor !== 'branca' || bandeira.advertencias > 0 || bandeira.agravos > 0)

  return (
    <div className="flex flex-col gap-4">
      {mostrarBanner && (
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-4 py-3 text-sm ${
            bandeira.cor === 'vermelha' || bandeira.cor === 'preta'
              ? 'bg-status-danger-bg text-status-danger'
              : 'bg-status-warning-bg text-status-warning'
          }`}
        >
          <Flag className="size-4 shrink-0" />
          <span className="font-medium">Bandeira {FLAG_LABELS[bandeira.cor as FlagCor]} ativa</span>
          <span className="opacity-80">
            · {bandeira.advertencias}{' '}
            {bandeira.advertencias === 1 ? 'advertência' : 'advertências'} · {bandeira.agravos}{' '}
            {bandeira.agravos === 1 ? 'agravo' : 'agravos'} neste ciclo
          </span>
          <Link
            to="/warnings"
            className="ml-auto inline-flex items-center gap-1 font-medium underline underline-offset-2"
          >
            Ver detalhes
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="size-4" />
                Diário de liderança
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Tudo que foi conversado, reconhecido e alinhado — em ordem, ciclo a ciclo.
              </p>
            </div>
            {podeEditar && (
              <Button size="sm" onClick={() => setEscolhendo(true)}>
                <Plus className="size-4" />
                Nova interação
              </Button>
            )}
          </div>

          {entriesQ.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : porCiclo.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="Nada registrado ainda"
              description={
                podeEditar
                  ? `Registre a primeira 1:1, um reconhecimento ou um alinhamento com ${primeiroNome}. Em 30 segundos você já tem contexto para a próxima conversa.`
                  : 'Quando sua liderança registrar uma conversa ou reconhecimento, aparece aqui.'
              }
              action={
                podeEditar ? (
                  <Button size="sm" onClick={() => setEscolhendo(true)}>
                    <Plus className="size-4" />
                    Registrar primeira interação
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-5">
              {porCiclo.map(([ciclo, itens]) => (
                <div key={ciclo}>
                  <div className="text-muted-foreground mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                    Ciclo {ciclo}
                    <span className="bg-muted rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                      {itens.length} {itens.length === 1 ? 'registro' : 'registros'}
                    </span>
                    <span className="bg-border h-px flex-1" />
                  </div>
                  <ol className="flex flex-col gap-2">
                    {itens.map((e) => {
                      const Icon = ICONE[e.tipo]
                      const aberto = expandido === e.id
                      return (
                        <li key={e.id} className="bg-card rounded-xl border">
                          <button
                            type="button"
                            onClick={() => setExpandido(aberto ? null : e.id)}
                            className="hover:bg-accent/40 flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors"
                          >
                            <span
                              className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${COR[e.tipo]}`}
                            >
                              <Icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">
                                {e.tipo === 'reconhecimento' && e.reconhecimento_tipo
                                  ? e.reconhecimento_tipo
                                  : TIPO_LABEL[e.tipo]}
                              </span>
                              <span className="text-muted-foreground block text-xs">
                                {fmtDate(e.data)}
                                {e.autor?.nome && ` · registrado por ${e.autor.nome}`}
                              </span>
                            </span>
                            {e.tipo === 'acompanhamento' && (
                              <Badge variant="warning">Interno</Badge>
                            )}
                          </button>

                          {aberto && (
                            <div className="flex flex-col gap-3 border-t px-3 py-3 text-sm">
                              {e.tipo === 'one_on_one' && (
                                <>
                                  <Campo titulo="Pontos fortes observados" texto={e.pontos_fortes} />
                                  <Campo titulo="Pontos de atenção" texto={e.pontos_atencao} />
                                  <Campo titulo="Plano de ação combinado" texto={e.plano_acao} />
                                  {e.proxima_1a1 && (
                                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                      <CalendarDays className="size-3.5" />
                                      Próxima 1:1 em {fmtDate(e.proxima_1a1)}
                                    </p>
                                  )}
                                </>
                              )}
                              {e.tipo === 'reconhecimento' && (
                                <Campo titulo="Descrição" texto={e.descricao} />
                              )}
                              {e.tipo === 'acompanhamento' && (
                                <>
                                  <Campo titulo="Motivo" texto={e.motivo} />
                                  <Campo titulo="O que foi combinado" texto={e.combinado} />
                                  {e.prazo_verificacao && (
                                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                      <CalendarDays className="size-3.5" />
                                      Verificar em {fmtDate(e.prazo_verificacao)}
                                    </p>
                                  )}
                                  {e.gerou_advertencia && (
                                    <Link
                                      to="/warnings"
                                      className="text-status-danger inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2"
                                    >
                                      Registrar a advertência formal em Warnings
                                      <ArrowUpRight className="size-3.5" />
                                    </Link>
                                  )}
                                </>
                              )}
                              {podeEditar && e.author_id === authorId && (
                                <button
                                  type="button"
                                  onClick={() => removerMut.mutate(e.id)}
                                  className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1.5 self-start text-xs"
                                >
                                  <Trash2 className="size-3.5" />
                                  Remover registro
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Escolha do tipo */}
      <Dialog open={escolhendo} onOpenChange={setEscolhendo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova interação</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <EscolhaTipo
              tipo="one_on_one"
              titulo="Reunião 1:1"
              descricao="Pontos fortes, atenção e o plano combinado."
              onClick={() => {
                setEscolhendo(false)
                setModal('one_on_one')
              }}
            />
            <EscolhaTipo
              tipo="reconhecimento"
              titulo="Reconhecimento"
              descricao="Um selo de destaque — visível para a pessoa e para o Banco de Talentos."
              onClick={() => {
                setEscolhendo(false)
                setModal('reconhecimento')
              }}
            />
            <EscolhaTipo
              tipo="acompanhamento"
              titulo="Acompanhamento formal"
              descricao="Alinhamento sério ou plano de melhoria. Invisível para a pessoa."
              onClick={() => {
                setEscolhendo(false)
                setModal('acompanhamento')
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ModalInteracao
        tipo={modal}
        onFechar={() => setModal(null)}
        personId={personId}
        cycleId={cycleId}
        authorId={authorId}
      />
    </div>
  )
}

function Campo({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{titulo}</p>
      <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{texto}</p>
    </div>
  )
}

function EscolhaTipo({
  tipo,
  titulo,
  descricao,
  onClick,
}: {
  tipo: TipoInteracao
  titulo: string
  descricao: string
  onClick: () => void
}) {
  const Icon = ICONE[tipo]
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent/50 flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors"
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${COR[tipo]}`}>
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="text-muted-foreground block text-xs leading-relaxed">{descricao}</span>
      </span>
    </button>
  )
}

const CAMPO_CLS =
  'border-input bg-card focus-visible:ring-ring/60 h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2'

function ModalInteracao({
  tipo,
  onFechar,
  personId,
  cycleId,
  authorId,
}: {
  tipo: TipoInteracao | null
  onFechar: () => void
  personId: string
  cycleId: string
  authorId: string
}) {
  const qc = useQueryClient()
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [fortes, setFortes] = useState('')
  const [atencao, setAtencao] = useState('')
  const [plano, setPlano] = useState('')
  const [proxima, setProxima] = useState('')
  const [selo, setSelo] = useState<string>(RECONHECIMENTOS[0])
  const [descricao, setDescricao] = useState('')
  const [motivo, setMotivo] = useState<string>(MOTIVOS_ACOMPANHAMENTO[0])
  const [combinado, setCombinado] = useState('')
  const [prazo, setPrazo] = useState('')
  const [gerou, setGerou] = useState(false)
  const [eventoId, setEventoId] = useState('')

  const eventosQ = useQuery({
    queryKey: ['perfil-eventos-proximos', personId, data],
    queryFn: () => getEventosProximos(personId, data),
    enabled: tipo === 'one_on_one',
  })

  function limpar() {
    setFortes('')
    setAtencao('')
    setPlano('')
    setProxima('')
    setDescricao('')
    setCombinado('')
    setPrazo('')
    setGerou(false)
    setEventoId('')
  }

  const mut = useMutation({
    mutationFn: () => {
      if (!tipo) throw new Error('sem tipo')
      const base = { person_id: personId, cycle_id: cycleId, author_id: authorId, tipo, data }
      if (tipo === 'one_on_one')
        return addLeadershipEntry({
          ...base,
          pontos_fortes: fortes.trim(),
          pontos_atencao: atencao.trim(),
          plano_acao: plano.trim(),
          proxima_1a1: proxima || null,
          event_id: eventoId || null,
        })
      if (tipo === 'reconhecimento')
        return addLeadershipEntry({ ...base, reconhecimento_tipo: selo, descricao: descricao.trim() })
      return addLeadershipEntry({
        ...base,
        motivo,
        combinado: combinado.trim(),
        prazo_verificacao: prazo || null,
        gerou_advertencia: gerou,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perfil-lideranca', personId] })
      limpar()
      onFechar()
    },
  })

  const valido =
    tipo === 'one_on_one'
      ? !!fortes.trim() && !!atencao.trim() && !!plano.trim()
      : tipo === 'reconhecimento'
        ? !!descricao.trim()
        : !!combinado.trim() && !!prazo

  return (
    <Dialog open={tipo !== null} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tipo ? TIPO_LABEL[tipo] : ''}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valido) mut.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="li-data">Data</Label>
            <Input id="li-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          {tipo === 'one_on_one' && (
            <>
              <CampoTexto
                id="li-fortes"
                label="Pontos fortes observados"
                valor={fortes}
                onChange={setFortes}
                placeholder="O que essa pessoa fez bem desde a última conversa?"
              />
              <CampoTexto
                id="li-atencao"
                label="Pontos de atenção"
                valor={atencao}
                onChange={setAtencao}
                placeholder="O que precisa de ajuste?"
              />
              <CampoTexto
                id="li-plano"
                label="Plano de ação combinado"
                valor={plano}
                onChange={setPlano}
                placeholder="O que vocês combinaram até a próxima 1:1?"
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="li-proxima">Próxima 1:1 (opcional)</Label>
                <Input
                  id="li-proxima"
                  type="date"
                  value={proxima}
                  onChange={(e) => setProxima(e.target.value)}
                />
              </div>
              {(eventosQ.data ?? []).length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="li-evento">Vincular a um evento da Agenda</Label>
                  <select
                    id="li-evento"
                    className={CAMPO_CLS}
                    value={eventoId}
                    onChange={(e) => setEventoId(e.target.value)}
                  >
                    <option value="">Não vincular</option>
                    {(eventosQ.data ?? []).map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.titulo || 'Evento'} · {fmtDate(ev.data)}
                      </option>
                    ))}
                  </select>
                  <p className="text-muted-foreground text-xs">
                    Encontramos eventos com essa pessoa por perto dessa data.
                  </p>
                </div>
              )}
            </>
          )}

          {tipo === 'reconhecimento' && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="li-selo">Tipo de reconhecimento</Label>
                <select
                  id="li-selo"
                  className={CAMPO_CLS}
                  value={selo}
                  onChange={(e) => setSelo(e.target.value)}
                >
                  {RECONHECIMENTOS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <CampoTexto
                id="li-desc"
                label="Descrição"
                valor={descricao}
                onChange={setDescricao}
                max={300}
                placeholder="O que aconteceu que merece esse reconhecimento?"
              />
            </>
          )}

          {tipo === 'acompanhamento' && (
            <>
              <div className="bg-status-warning-bg text-status-warning rounded-lg px-3 py-2 text-xs">
                Este registro é interno da liderança — a pessoa não o enxerga no próprio perfil.
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="li-motivo">Motivo</Label>
                <select
                  id="li-motivo"
                  className={CAMPO_CLS}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                >
                  {MOTIVOS_ACOMPANHAMENTO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <CampoTexto
                id="li-combinado"
                label="O que foi combinado"
                valor={combinado}
                onChange={setCombinado}
                placeholder="O acordo feito na conversa"
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="li-prazo">Prazo de verificação</Label>
                <Input
                  id="li-prazo"
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={gerou}
                  onChange={(e) => setGerou(e.target.checked)}
                  className="accent-primary size-4"
                />
                Esta conversa gerou advertência formal
              </label>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!valido || mut.isPending}>
              Registrar
            </Button>
          </div>
          {mut.isError && (
            <p className="text-destructive text-xs">Não foi possível registrar. Tente novamente.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CampoTexto({
  id,
  label,
  valor,
  onChange,
  placeholder,
  max = 500,
}: {
  id: string
  label: string
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  max?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {valor.length}/{max}
        </span>
      </div>
      <Textarea
        id={id}
        maxLength={max}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}
