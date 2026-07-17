/**
 * Meus Liderados (Blueprint §5.1) — visão de liderança perfil a perfil.
 * · Diretor: GERENTES + ASSESSORES da própria diretoria.
 * · Gerente/Coordenador: apenas ASSESSORES da própria subárea.
 * PDI (visão + metas) e histórico de 1:1. Somente lideranças.
 * O escopo (própria diretoria/subárea) é garantido pela liderados_view.
 */
import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Lock, Plus, Target, TrendingUp, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import {
  addCheckin,
  addGoal,
  getCheckins,
  getGoals,
  getLiderados,
  getPdiByPerson,
  setGoalStatus,
  upsertPdi,
  type Liderado,
} from '@/lib/pdi'
import { getPersonRaPresence } from '@/lib/reunioes'
import { ROLE_LABELS } from '@/lib/org'
import { fmtDate } from '@/lib/use-context-scope'
import { initials } from '@/lib/utils'

export const Route = createFileRoute('/_app/liderados')({ component: LideradosPage })

const GERENTE_ROLES = ['gerente', 'coordenador']

function LideradosPage() {
  const { isLeader, isDirex, cycle } = useApp()
  const [selecionado, setSelecionado] = useState<Liderado | null>(null)
  const q = useQuery({ queryKey: ['liderados'], queryFn: getLiderados, enabled: isLeader })

  const { gerentes, assessores } = useMemo(() => {
    const data = q.data ?? []
    return {
      gerentes: data.filter((l) => GERENTE_ROLES.includes(l.role)),
      assessores: data.filter((l) => !GERENTE_ROLES.includes(l.role)),
    }
  }, [q.data])

  if (!isLeader) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <Lock className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">Somente lideranças</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Esta área é exclusiva de diretores, gerentes e coordenadores.
        </p>
      </div>
    )
  }

  const emRisco = (q.data ?? []).filter((l) => l.risco).length

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Users className="size-6" />
          Meus Liderados
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isDirex
            ? 'Gerentes e assessores da sua diretoria, perfil a perfil'
            : 'Assessores da sua área, perfil a perfil'}{' '}
          · Ciclo {cycle.nome} ·{' '}
          {emRisco > 0 ? `${emRisco} em risco de desengajamento` : 'ninguém em risco'}
        </p>
      </header>

      {q.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (q.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            Nenhum liderado cadastrado ainda neste ciclo.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="flex flex-col gap-4 lg:col-span-2">
            {isDirex && (
              <PeopleSection
                titulo="Gerentes"
                pessoas={gerentes}
                selecionado={selecionado}
                onSelect={setSelecionado}
                vazio="Nenhum gerente na sua diretoria."
              />
            )}
            <PeopleSection
              titulo="Assessores"
              pessoas={assessores}
              selecionado={selecionado}
              onSelect={setSelecionado}
              vazio="Nenhum assessor cadastrado."
            />
          </div>
          <div className="lg:col-span-3">
            {selecionado ? (
              <PersonPanel key={selecionado.person_id} liderado={selecionado} />
            ) : (
              <Card>
                <CardContent className="text-muted-foreground p-10 text-center text-sm">
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PeopleSection({
  titulo,
  pessoas,
  selecionado,
  onSelect,
  vazio,
}: {
  titulo: string
  pessoas: Liderado[]
  selecionado: Liderado | null
  onSelect: (l: Liderado) => void
  vazio: string
}) {
  const ordenados = [...pessoas].sort((a, b) => Number(b.risco) - Number(a.risco))
  return (
    <div>
      <div className="text-muted-foreground mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide">
        {titulo}
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium">
          {pessoas.length}
        </span>
      </div>
      {pessoas.length === 0 ? (
        <p className="text-muted-foreground px-1 text-xs">{vazio}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {ordenados.map((l) => (
            <button
              key={l.person_id ?? l.email}
              onClick={() => onSelect(l)}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                selecionado?.person_id === l.person_id
                  ? 'bg-accent border-ring'
                  : 'bg-card hover:bg-accent/50'
              }`}
            >
              <Avatar className="size-8">
                {l.foto_url && <AvatarImage src={l.foto_url} alt={l.nome} />}
                <AvatarFallback className="text-xs">{initials(l.nome)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.nome}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {ROLE_LABELS[l.role]} · {l.area}
                </p>
              </div>
              {!l.ativo ? (
                <Badge variant="neutral">Não ativou</Badge>
              ) : l.risco ? (
                <Badge variant="danger">Risco</Badge>
              ) : (
                <Badge variant="success">Ok</Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Target
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="bg-card rounded-xl border p-3">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
    </div>
  )
}

function PersonPanel({ liderado }: { liderado: Liderado }) {
  const { person, cycle } = useApp()
  const queryClient = useQueryClient()
  const [visao, setVisao] = useState<string | null>(null)
  const [novoCheckin, setNovoCheckin] = useState('')
  const [dataCheckin, setDataCheckin] = useState(() => new Date().toISOString().slice(0, 10))
  const [novaMeta, setNovaMeta] = useState('')
  const personId = liderado.person_id

  const planQ = useQuery({
    queryKey: ['pdi-person', personId, cycle.id],
    queryFn: () => getPdiByPerson(personId!, cycle.id),
    enabled: !!personId,
  })
  const planId = planQ.data?.id
  const goalsQ = useQuery({
    queryKey: ['pdi-goals', planId],
    queryFn: () => getGoals(planId!),
    enabled: !!planId,
  })

  const raQ = useQuery({
    queryKey: ['liderado-ra-presenca', liderado.email, cycle.id],
    queryFn: () => getPersonRaPresence(liderado.email, cycle.id),
    enabled: !!personId,
  })
  const checkinsQ = useQuery({
    queryKey: ['pdi-checkins', planId],
    queryFn: () => getCheckins(planId!),
    enabled: !!planId,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['pdi-person', liderado.person_id] })
    queryClient.invalidateQueries({ queryKey: ['pdi-goals', planId] })
    queryClient.invalidateQueries({ queryKey: ['pdi-checkins', planId] })
    queryClient.invalidateQueries({ queryKey: ['liderados'] })
  }

  const saveVisaoMut = useMutation({
    mutationFn: () => upsertPdi(personId!, person.id, visao ?? planQ.data?.visao ?? '', planId),
    onSuccess: invalidate,
  })
  const addMetaMut = useMutation({
    mutationFn: () => addGoal(planId!, { meta: novaMeta }),
    onSuccess: () => {
      setNovaMeta('')
      invalidate()
    },
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'aberta' | 'concluida' }) =>
      setGoalStatus(id, status),
    onSuccess: invalidate,
  })
  const addCheckinMut = useMutation({
    mutationFn: () =>
      addCheckin(planId!, person.id, { data: dataCheckin, notas: novoCheckin, tipo: 'extra' }),
    onSuccess: () => {
      setNovoCheckin('')
      invalidate()
    },
  })

  const goals = goalsQ.data ?? []
  const metasConcluidas = goals.filter((g) => g.status === 'concluida').length
  const checkins = checkinsQ.data ?? []
  
  if (!liderado.ativo || !personId) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-11">
              <AvatarFallback>{initials(liderado.nome)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold">{liderado.nome}</h2>
              <p className="text-muted-foreground text-sm">
                {ROLE_LABELS[liderado.role]} · {liderado.area}
              </p>
            </div>
            <Badge variant="neutral">Não ativou</Badge>
          </div>
          <div className="bg-muted/40 text-muted-foreground rounded-xl border p-4 text-sm">
            <p className="text-foreground font-medium">Conta ainda não ativada</p>
            <p className="mt-1">
              {liderado.nome.split(' ')[0]} está no roster do ciclo, mas ainda não criou a conta
              no BEV OS. Assim que ativar com o e-mail{' '}
              histórico de 1:1 aparecem aqui.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-5">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            {liderado.foto_url && <AvatarImage src={liderado.foto_url} alt={liderado.nome} />}
            <AvatarFallback>{initials(liderado.nome)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{liderado.nome}</h2>
            <p className="text-muted-foreground text-sm">
              {ROLE_LABELS[liderado.role]} · {liderado.area}
            </p>
          </div>
          {liderado.risco ? (
            <Badge variant="danger">Risco de desengajamento</Badge>
          ) : (
            <Badge variant="success">Engajado</Badge>
          )}
        </div>

        {/* Desempenho */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="size-4" /> Desempenho no ciclo
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              icon={Target}
              label="Metas PDI"
              value={`${metasConcluidas}/${goals.length}`}
              hint="concluídas"
            />
            <Stat
              icon={CalendarCheck}
              label="1:1 do PDI"
              value={String(checkins.length)}
              hint="realizadas"
            />
          </div>

          <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
            <span>Presença em reuniões de área</span>
            <span className="text-foreground font-medium">
              {raQ.data && raQ.data.total > 0 ? `${raQ.data.present}/${raQ.data.total}` : '—'}
            </span>
          </div>
        </div>



        {/* PDI */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Target className="size-4" /> PDI
          </div>
          {planQ.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Visão de desenvolvimento</Label>
                <Textarea
                  defaultValue={planQ.data?.visao ?? ''}
                  onChange={(e) => setVisao(e.target.value)}
                  placeholder="Onde essa pessoa quer chegar neste ciclo…"
                />
                <Button
                  size="sm"
                  className="self-start"
                  disabled={saveVisaoMut.isPending}
                  onClick={() => saveVisaoMut.mutate()}
                >
                  {planQ.data ? 'Salvar avaliação' : 'Iniciar PDI'}
                </Button>
              </div>

              {planId && (
                <div>
                  <div className="mb-1.5 text-sm font-medium">Metas</div>
                  <div className="flex flex-col gap-2">
                    {goals.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center gap-2 rounded-md border p-2.5 text-sm"
                      >
                        <Badge variant={g.status === 'concluida' ? 'success' : 'info'}>
                          {g.status === 'concluida' ? 'Concluída' : 'Aberta'}
                        </Badge>
                        <span className="flex-1">{g.meta}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() =>
                            statusMut.mutate({
                              id: g.id,
                              status: g.status === 'aberta' ? 'concluida' : 'aberta',
                            })
                          }
                        >
                          {g.status === 'aberta' ? 'Concluir' : 'Reabrir'}
                        </Button>
                      </div>
                    ))}
                    {goals.length === 0 && (
                      <p className="text-muted-foreground text-sm">Nenhuma meta registrada.</p>
                    )}
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        if (novaMeta.trim()) addMetaMut.mutate()
                      }}
                    >
                      <Input
                        placeholder="Nova meta…"
                        value={novaMeta}
                        onChange={(e) => setNovaMeta(e.target.value)}
                      />
                      <Button type="submit" size="sm" variant="secondary" disabled={addMetaMut.isPending}>
                        <Plus className="size-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Histórico de 1:1 */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <CalendarCheck className="size-4" /> 1:1 do PDI
          </div>
          {!planId ? (
            <p className="text-muted-foreground text-sm">
              Inicie o PDI acima para registrar as reuniões 1:1.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (novoCheckin.trim()) addCheckinMut.mutate()
                }}
              >
                <Input
                  type="date"
                  value={dataCheckin}
                  onChange={(e) => setDataCheckin(e.target.value)}
                  className="sm:w-40"
                />
                <Input
                  placeholder="Resumo da conversa…"
                  value={novoCheckin}
                  onChange={(e) => setNovoCheckin(e.target.value)}
                />
                <Button type="submit" size="sm" disabled={addCheckinMut.isPending}>
                  Registrar
                </Button>
              </form>
              {checkinsQ.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : checkins.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma 1:1 registrada ainda.</p>
              ) : (
                <ol className="border-muted flex flex-col gap-3 border-l pl-4">
                  {checkins.map((c) => (
                    <li key={c.id} className="relative">
                      <span className="bg-primary absolute -left-[21px] top-1.5 size-2 rounded-full" />
                      <div className="text-xs font-medium">
                        {fmtDate(c.data)}
                        {c.lider?.nome && (
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            · {c.lider.nome}
                          </span>
                        )}
                      </div>
                      {c.notas && <p className="text-muted-foreground mt-0.5 text-sm">{c.notas}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
