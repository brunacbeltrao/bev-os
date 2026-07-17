/**
 * PDI completo (compilado de P&C) — 6 seções, com visibilidade por papel
 * e lógica condicional (validação após visão, revelação cega da avaliação).
 * "Meu PDI" (o membro edita perfil/visão/autoavaliação/status de metas) e
 * "PDIs que acompanho" (liderança e P&C alimentam avaliação, metas, 1:1s,
 * competências, engajamento e potencial). Campos ultrassensíveis
 * (engajamento percebido, potencial PDL) só a liderança/P&C leem.
 */
import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Lock, Target, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-context'
import { getPerson, getMyOccupations, occupationAreaLabel, ROLE_LABELS } from '@/lib/org'
import { fmtDate } from '@/lib/use-context-scope'
import { initials } from '@/lib/utils'
import {
  createPdi,
  getCheckins,
  getCompetencies,
  getCompetencyScores,
  getGoals,
  getLeadershipNotes,
  getLiderados,
  getMyPdi,
  setCompetencyScore,
  setGoalStatus,
  updateGoal,
  updatePlan,
  upsertLeadershipNotes,
  GOAL_STATUS_BADGE,
  GOAL_STATUS_LABELS,
  QUADRANTE_LABEL,
  type GoalStatus,
  type Liderado,
  type PdiPlan,
  type Quadrante,
} from '@/lib/pdi'
import { NovaMetaForm } from '@/components/features/pdi/nova-meta-form'
import { NovoCheckinForm } from '@/components/features/pdi/novo-checkin-form'

export const Route = createFileRoute('/_app/pdi')({ component: PdiPage })

const QUADRANTES: Quadrante[] = ['D1', 'D2', 'D3', 'D4']
const POTENCIAL = [
  { v: 'sim', l: 'Sim' },
  { v: 'a_desenvolver', l: 'A desenvolver' },
  { v: 'nao', l: 'Não neste ciclo' },
]

function Section({
  titulo,
  aberto,
  onToggle,
  children,
}: {
  titulo: string
  aberto: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border">
      <button
        onClick={onToggle}
        className="hover:bg-accent/40 flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold">{titulo}</span>
        <ChevronDown className={`size-4 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && <div className="flex flex-col gap-3 border-t p-4">{children}</div>}
    </div>
  )
}

function Campo({
  label,
  defaultValue,
  onSave,
  editavel,
  area,
  placeholder,
}: {
  label: string
  defaultValue: string
  onSave: (v: string) => void
  editavel: boolean
  area?: boolean
  placeholder?: string
}) {
  if (!editavel) {
    return (
      <div>
        <div className="text-muted-foreground mb-0.5 text-xs font-medium uppercase tracking-wide">{label}</div>
        <p className="whitespace-pre-wrap text-sm">{defaultValue || '—'}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {area ? (
        <Textarea
          defaultValue={defaultValue}
          placeholder={placeholder}
          onBlur={(e) => e.target.value !== defaultValue && onSave(e.target.value)}
        />
      ) : (
        <Input
          defaultValue={defaultValue}
          placeholder={placeholder}
          onBlur={(e) => e.target.value !== defaultValue && onSave(e.target.value)}
        />
      )}
    </div>
  )
}

function PdiWorkspace({ personId }: { personId: string }) {
  const queryClient = useQueryClient()
  const { person: me, cycle } = useApp()
  const souMembro = personId === me.id
  const [aberta, setAberta] = useState<string>('metas')

  const personQ = useQuery({ queryKey: ['person', personId], queryFn: () => getPerson(personId) })
  const occQ = useQuery({
    queryKey: ['my-occupations', personId, cycle.id],
    queryFn: () => getMyOccupations(personId, cycle.id),
  })
  const planQ = useQuery({
    queryKey: ['pdi-person', personId, cycle.id],
    queryFn: () => getMyPdi(personId, cycle.id),
  })
  const plan = planQ.data
  const leaderEdit = !souMembro
  const memberEdit = souMembro

  const inv = () => {
    queryClient.invalidateQueries({ queryKey: ['pdi-person', personId] })
    queryClient.invalidateQueries({ queryKey: ['liderados'] })
  }
  const createMut = useMutation({
    mutationFn: () => createPdi(personId, souMembro ? null : me.id),
    onSuccess: inv,
  })
  const savePlan = useMutation({
    mutationFn: (patch: Partial<PdiPlan>) => updatePlan(plan!.id, patch),
    onSuccess: inv,
  })

  if (planQ.isPending || personQ.isPending || occQ.isPending)
    return <Skeleton className="h-64 w-full" />

  const principal = (occQ.data ?? []).find((o) => !o.is_hibrido) ?? occQ.data?.[0]
  const perfil = personQ.data

  if (!plan) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <Target className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">
            {souMembro
              ? 'Seu PDI ainda não foi aberto neste ciclo.'
              : 'Esta pessoa ainda não tem PDI neste ciclo.'}
          </p>
          <Button disabled={createMut.isPending} onClick={() => createMut.mutate()}>
            {souMembro ? 'Abrir meu PDI' : 'Iniciar PDI'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const toggle = (k: string) => setAberta((a) => (a === k ? '' : k))

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Perfil */}
      <Section titulo="1 · Perfil e trajetória" aberto={aberta === 'perfil'} onToggle={() => toggle('perfil')}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs uppercase">Membro</div>
            {perfil?.nome}
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase">No Bevilaqua desde</div>
            {perfil?.entrou_em ? fmtDate(perfil.entrou_em) : '—'}
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase">Área e cargo</div>
            {principal ? `${ROLE_LABELS[principal.role]} · ${occupationAreaLabel(principal)}` : '—'}
          </div>
        </div>
        <Campo label="Situação de estágio atual" editavel={memberEdit} defaultValue={plan.situacao_estagio ?? ''} onSave={(v) => savePlan.mutate({ situacao_estagio: v })} />
        <Campo label="Disponibilidade semanal (horas)" editavel={memberEdit} defaultValue={plan.disponibilidade_horas?.toString() ?? ''} onSave={(v) => savePlan.mutate({ disponibilidade_horas: v ? Number(v) : null })} />
        <Campo label="Aspiração dentro do Bevilaqua" editavel={memberEdit} area defaultValue={plan.aspiracao ?? ''} onSave={(v) => savePlan.mutate({ aspiracao: v })} />
      </Section>

      {/* 2. Visão */}
      <Section titulo="2 · Visão de desenvolvimento do ciclo" aberto={aberta === 'visao'} onToggle={() => toggle('visao')}>
        <Campo label="O que quero desenvolver neste ciclo" editavel={memberEdit} area defaultValue={plan.visao ?? ''} onSave={(v) => savePlan.mutate({ visao: v })} />
        <Campo label="O que me motiva a estar no Bevilaqua hoje" editavel={memberEdit} area defaultValue={plan.motivacao ?? ''} onSave={(v) => savePlan.mutate({ motivacao: v })} />
        <Campo label="Onde quero estar ao fim deste ciclo" editavel={memberEdit} area defaultValue={plan.onde_chegar ?? ''} onSave={(v) => savePlan.mutate({ onde_chegar: v })} />
        {(leaderEdit || plan.validacao_lideranca) && (
          <Campo label="Validação da liderança (após a 1:1 inicial)" editavel={leaderEdit} area defaultValue={plan.validacao_lideranca ?? ''} onSave={(v) => savePlan.mutate({ validacao_lideranca: v })} placeholder="Comentário do gerente sobre a visão…" />
        )}
      </Section>

      {/* 3. Competências */}
      <CompetenciasSection plan={plan} subareaId={principal?.subarea.id ?? null} leaderEdit={leaderEdit} onQuadrante={(q) => savePlan.mutate({ quadrante: q })} />

      {/* 4. Metas */}
      <MetasSection plan={plan} subareaId={principal?.subarea.id ?? null} leaderEdit={leaderEdit} memberEdit={memberEdit} />

      {/* 5. 1:1 */}
      <CheckinsSection plan={plan} leaderEdit={leaderEdit} />

      {/* 6. Avaliação final + notas restritas */}
      <AvaliacaoSection plan={plan} souMembro={souMembro} leaderEdit={leaderEdit} onSave={(p) => savePlan.mutate(p)} />
      {leaderEdit && <LeadershipNotesBox planId={plan.id} />}
    </div>
  )
}

function CompetenciasSection({
  plan,
  subareaId,
  leaderEdit,
  onQuadrante,
}: {
  plan: PdiPlan
  subareaId: string | null
  leaderEdit: boolean
  onQuadrante: (q: Quadrante) => void
}) {
  const { person: me } = useApp()
  const queryClient = useQueryClient()
  const [aberto, setAberto] = useState(false)
  const compsQ = useQuery({ queryKey: ['competencies', subareaId], queryFn: () => getCompetencies(subareaId), staleTime: Infinity })
  const scoresQ = useQuery({ queryKey: ['comp-scores', plan.id], queryFn: () => getCompetencyScores(plan.id) })
  const setMut = useMutation({
    mutationFn: (v: { competencyId: string; nota: number }) => setCompetencyScore(plan.id, v.competencyId, v.nota, me.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comp-scores', plan.id] }),
  })
  const latest = (id: string) => (scoresQ.data ?? []).find((s) => s.competency_id === id)?.nota
  const grupos: Array<[string, string]> = [
    ['comportamental', 'Comportamentais e culturais'],
    ['lideranca', 'Liderança'],
    ['tecnica', 'Técnicas da área'],
  ]

  return (
    <Section titulo="3 · Competências e posição situacional" aberto={aberto} onToggle={() => setAberto((a) => !a)}>
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs">Quadrante situacional:</Label>
        {leaderEdit ? (
          QUADRANTES.map((q) => (
            <button key={q} onClick={() => onQuadrante(q)} className={`rounded-md border px-2 py-1 text-xs ${plan.quadrante === q ? 'bg-accent border-ring' : 'bg-card'}`} title={QUADRANTE_LABEL[q]}>
              {q}
            </button>
          ))
        ) : (
          <Badge variant="info">{plan.quadrante ? QUADRANTE_LABEL[plan.quadrante] : 'não avaliado'}</Badge>
        )}
      </div>
      {grupos.map(([cat, titulo]) => {
        const comps = (compsQ.data ?? []).filter((c) => c.categoria === cat)
        if (comps.length === 0) return null
        return (
          <div key={cat}>
            <div className="text-muted-foreground mb-1 text-xs font-semibold uppercase">{titulo}</div>
            <div className="flex flex-col gap-1.5">
              {comps.map((c) => {
                const nota = latest(c.id)
                return (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{c.nome}</span>
                    {leaderEdit ? (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((n) => (
                          <button key={n} onClick={() => setMut.mutate({ competencyId: c.id, nota: n })} className={`size-6 rounded border text-xs ${nota === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-card'}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Badge variant={nota ? 'info' : 'neutral'}>{nota ? `Nível ${nota}` : '—'}</Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      <p className="text-muted-foreground text-xs">Escala 1–4: 1 em desenvolvimento · 2 em consolidação · 3 consolidada · 4 referência.</p>
    </Section>
  )
}

function MetasSection({
  plan,
  subareaId,
  leaderEdit,
  memberEdit,
}: {
  plan: PdiPlan
  subareaId: string | null
  leaderEdit: boolean
  memberEdit: boolean
}) {
  const queryClient = useQueryClient()
  const [aberto, setAberto] = useState(true)
  const goalsQ = useQuery({ queryKey: ['pdi-goals', plan.id], queryFn: () => getGoals(plan.id) })
  const compsQ = useQuery({ queryKey: ['competencies', subareaId], queryFn: () => getCompetencies(subareaId), staleTime: Infinity })
  const inv = () => queryClient.invalidateQueries({ queryKey: ['pdi-goals', plan.id] })
  const updMut = useMutation({ mutationFn: (v: { id: string; patch: any }) => updateGoal(v.id, v.patch), onSuccess: inv })
  const statusMut = useMutation({ mutationFn: (v: { id: string; status: GoalStatus }) => setGoalStatus(v.id, v.status), onSuccess: inv })

  return (
    <Section titulo="4 · Metas do ciclo" aberto={aberto} onToggle={() => setAberto((a) => !a)}>
      {(goalsQ.data ?? []).map((g) => (
        <div key={g.id} className="flex flex-col gap-2 rounded-lg border p-3">
          <div className="flex items-start gap-2">
            <span className="flex-1 text-sm font-medium">{g.meta}</span>
            <Badge variant={GOAL_STATUS_BADGE[g.status]}>{GOAL_STATUS_LABELS[g.status]}</Badge>
          </div>
          {leaderEdit && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Campo label="Critério de sucesso" editavel defaultValue={g.criterio_sucesso ?? ''} onSave={(v) => updMut.mutate({ id: g.id, patch: { criterio_sucesso: v } })} area />
              <Campo label="Indicador" editavel defaultValue={g.indicador ?? ''} onSave={(v) => updMut.mutate({ id: g.id, patch: { indicador: v } })} />
              <Campo label="Prazo" editavel defaultValue={g.prazo ?? ''} onSave={(v) => updMut.mutate({ id: g.id, patch: { prazo: v || null } })} placeholder="AAAA-MM-DD" />
              <div className="flex flex-col gap-1">
                <Label>Competência</Label>
                <select className="border-input bg-card h-9 rounded-md border px-2 text-sm" defaultValue={g.competency_id ?? ''} onChange={(e) => updMut.mutate({ id: g.id, patch: { competency_id: e.target.value || null } })}>
                  <option value="">—</option>
                  {(compsQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Fonte</Label>
                <select className="border-input bg-card h-9 rounded-md border px-2 text-sm" defaultValue={g.fonte ?? 'pdi'} onChange={(e) => updMut.mutate({ id: g.id, patch: { fonte: e.target.value } })}>
                  <option value="pdi">PDI</option>
                  <option value="pdia">PDIA</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
              <Campo label="Comentário da liderança" editavel defaultValue={g.comentario_lideranca ?? ''} onSave={(v) => updMut.mutate({ id: g.id, patch: { comentario_lideranca: v } })} area />
            </div>
          )}
          {!leaderEdit && g.criterio_sucesso && (
            <p className="text-muted-foreground text-xs">Critério: {g.criterio_sucesso}{g.prazo ? ` · prazo ${fmtDate(g.prazo)}` : ''}</p>
          )}
          {(memberEdit || leaderEdit) && (
            <div className="flex flex-wrap items-center gap-2">
              <select className="border-input bg-card h-8 rounded-md border px-2 text-xs" value={g.status} onChange={(e) => statusMut.mutate({ id: g.id, status: e.target.value as GoalStatus })}>
                {(Object.keys(GOAL_STATUS_LABELS) as GoalStatus[]).map((s) => <option key={s} value={s}>{GOAL_STATUS_LABELS[s]}</option>)}
              </select>
              <Input className="h-8 flex-1 text-xs" defaultValue={g.evidencia ?? ''} placeholder="Evidência (texto ou link)…" onBlur={(e) => e.target.value !== (g.evidencia ?? '') && updMut.mutate({ id: g.id, patch: { evidencia: e.target.value || null } })} />
            </div>
          )}
        </div>
      ))}
      {(goalsQ.data ?? []).length === 0 && <p className="text-muted-foreground text-sm">Nenhuma meta ainda. O ideal são 3 a 5 por ciclo.</p>}
      {leaderEdit && (
        <NovaMetaForm planId={plan.id} />
      )}
    </Section>
  )
}

function CheckinsSection({ plan, leaderEdit }: { plan: PdiPlan; leaderEdit: boolean }) {
  const { person: me } = useApp()
  const [aberto, setAberto] = useState(false)
  const q = useQuery({ queryKey: ['pdi-checkins', plan.id], queryFn: () => getCheckins(plan.id) })
  const tipoLabel: Record<string, string> = { pc_bimestral: '1:1 P&C', area_bimestral: '1:1 da área', extra: 'Extra' }

  return (
    <Section titulo="5 · Histórico de 1:1" aberto={aberto} onToggle={() => setAberto((a) => !a)}>
      {leaderEdit && (
        <NovoCheckinForm planId={plan.id} liderId={me.id} />
      )}
      {(q.data ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma 1:1 registrada.</p>
      ) : (
        <ol className="border-muted flex flex-col gap-3 border-l pl-4">
          {(q.data ?? []).map((c) => (
            <li key={c.id} className="relative">
              <span className="bg-primary absolute -left-[21px] top-1.5 size-2 rounded-full" />
              <div className="text-xs font-medium">
                {fmtDate(c.data)} · {c.tipo ? tipoLabel[c.tipo] ?? c.tipo : '1:1'}
                {c.quadrante && <span className="text-muted-foreground"> · {c.quadrante}</span>}
                {c.lider?.nome && <span className="text-muted-foreground font-normal"> · {c.lider.nome}</span>}
              </div>
              {c.notas && <p className="text-muted-foreground mt-0.5 text-sm">{c.notas}</p>}
              {c.encaminhamentos && <p className="mt-0.5 text-xs"><span className="font-medium">Encaminhamentos:</span> {c.encaminhamentos}</p>}
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

function AvaliacaoSection({
  plan,
  souMembro,
  leaderEdit,
  onSave,
}: {
  plan: PdiPlan
  souMembro: boolean
  leaderEdit: boolean
  onSave: (p: Partial<PdiPlan>) => void
}) {
  const [aberto, setAberto] = useState(false)
  const revelaLider = souMembro ? plan.lider_submetido && plan.auto_submetido : true
  const revelaAuto = leaderEdit ? plan.auto_submetido : true

  return (
    <Section titulo="6 · Avaliação e fechamento" aberto={aberto} onToggle={() => setAberto((a) => !a)}>
      {/* Autoavaliação do membro */}
      <div className="rounded-lg border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Autoavaliação do membro</span>
          {plan.auto_submetido && <Badge variant="success">Enviada</Badge>}
        </div>
        {revelaAuto ? (
          <div className="flex flex-col gap-3">
            <Campo label="O que desenvolvi neste ciclo" editavel={souMembro && !plan.auto_submetido} area defaultValue={plan.auto_desenvolvi ?? ''} onSave={(v) => onSave({ auto_desenvolvi: v })} />
            <Campo label="O que não consegui avançar e por quê" editavel={souMembro && !plan.auto_submetido} area defaultValue={plan.auto_nao_avancou ?? ''} onSave={(v) => onSave({ auto_nao_avancou: v })} />
            <Campo label="Como avalio minha evolução (1 a 5) — justificativa" editavel={souMembro && !plan.auto_submetido} area defaultValue={plan.auto_justificativa ?? ''} onSave={(v) => onSave({ auto_justificativa: v })} />
            <Campo label="O que espero do próximo ciclo" editavel={souMembro && !plan.auto_submetido} area defaultValue={plan.auto_proximo ?? ''} onSave={(v) => onSave({ auto_proximo: v })} />
            {souMembro && !plan.auto_submetido && (
              <Button size="sm" className="self-start" onClick={() => onSave({ auto_submetido: true })}>Enviar autoavaliação</Button>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Aguardando o membro enviar (revelação após o envio).</p>
        )}
      </div>

      {/* Avaliação da liderança */}
      <div className="rounded-lg border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Avaliação da liderança</span>
          {plan.lider_submetido && <Badge variant="success">Enviada</Badge>}
        </div>
        {revelaLider ? (
          <div className="flex flex-col gap-3">
            <Campo label="Avaliação geral do desenvolvimento (1 a 5) — justificativa" editavel={leaderEdit && !plan.lider_submetido} area defaultValue={plan.lider_avaliacao_geral ?? ''} onSave={(v) => onSave({ lider_avaliacao_geral: v })} />
            <Campo label="Recomendações para o próximo ciclo" editavel={leaderEdit && !plan.lider_submetido} area defaultValue={plan.lider_recomendacoes ?? ''} onSave={(v) => onSave({ lider_recomendacoes: v })} />
            {leaderEdit && !plan.lider_submetido && (
              <Button size="sm" className="self-start" onClick={() => onSave({ lider_submetido: true })}>Enviar avaliação</Button>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Visível após você enviar a sua autoavaliação e a liderança concluir.</p>
        )}
      </div>
    </Section>
  )
}

function LeadershipNotesBox({ planId }: { planId: string }) {
  const queryClient = useQueryClient()
  const q = useQuery({ queryKey: ['pdi-lnotes', planId], queryFn: () => getLeadershipNotes(planId) })
  const mut = useMutation({
    mutationFn: (patch: { engajamento?: number | null; potencial_pdl?: string | null }) => upsertLeadershipNotes(planId, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pdi-lnotes', planId] }),
  })
  const n = q.data
  return (
    <div className="rounded-xl border border-dashed p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Lock className="size-4" /> Notas da liderança (o membro não vê)
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs">Engajamento percebido</Label>
          {[1, 2, 3, 4, 5].map((v) => (
            <button key={v} onClick={() => mut.mutate({ engajamento: v })} className={`size-6 rounded border text-xs ${n?.engajamento === v ? 'bg-primary text-primary-foreground border-primary' : 'bg-card'}`}>{v}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs">Potencial para PDL</Label>
          <select className="border-input bg-card h-8 rounded-md border px-2 text-xs" value={n?.potencial_pdl ?? ''} onChange={(e) => mut.mutate({ potencial_pdl: e.target.value || null })}>
            <option value="">—</option>
            {POTENCIAL.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

function PdiPage() {
  const { person, cycle, isLeader, occupations } = useApp()
  const [sel, setSel] = useState<string | null>(null)
  const ehPC = occupations.some((o) => o.subarea.slug === 'pessoas_cultura')
  const acompanha = isLeader || ehPC

  const lideradosQ = useQuery({ queryKey: ['liderados'], queryFn: getLiderados, enabled: acompanha })
  const ativos = useMemo(
    () => (lideradosQ.data ?? []).filter((l) => l.ativo && l.person_id),
    [lideradosQ.data],
  )

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Target className="size-6" /> PDI
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Plano de Desenvolvimento Individual · Ciclo {cycle.nome}
        </p>
      </header>

      <h2 className="mb-2 text-sm font-semibold">Meu PDI</h2>
      <PdiWorkspace personId={person.id} />

      {acompanha && (
        <div className="mt-8">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4" /> PDIs que acompanho
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="flex flex-col gap-2 lg:col-span-2">
              {(ativos.length === 0) ? (
                <p className="text-muted-foreground text-sm">Ninguém ativo sob seu acompanhamento ainda.</p>
              ) : (
                ativos.map((l: Liderado) => (
                  <button
                    key={l.person_id}
                    onClick={() => setSel(l.person_id)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left ${sel === l.person_id ? 'bg-accent border-ring' : 'bg-card hover:bg-accent/50'}`}
                  >
                    <Avatar className="size-8">
                      {l.foto_url && <AvatarImage src={l.foto_url} alt={l.nome} />}
                      <AvatarFallback className="text-xs">{initials(l.nome)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.nome}</p>
                      <p className="text-muted-foreground truncate text-xs">{ROLE_LABELS[l.role]} · {l.area}</p>
                    </div>
                    {l.risco && <Badge variant="danger">Risco</Badge>}
                  </button>
                ))
              )}
            </div>
            <div className="lg:col-span-3">
              {sel ? (
                <PdiWorkspace key={sel} personId={sel} />
              ) : (
                <Card>
                  <CardContent className="text-muted-foreground p-10 text-center text-sm">
                    Selecione uma pessoa para acompanhar o PDI.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
