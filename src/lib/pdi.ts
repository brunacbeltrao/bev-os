/** PDI completo (compilado de P&C) — 6 seções. */
import { supabase } from './supabase'
import type { RoleType } from './org'

export type GoalStatus = 'aberta' | 'em_andamento' | 'concluida' | 'cancelada'
export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}
export const GOAL_STATUS_BADGE: Record<GoalStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  aberta: 'neutral',
  em_andamento: 'info',
  concluida: 'success',
  cancelada: 'danger',
}
export type Quadrante = 'D1' | 'D2' | 'D3' | 'D4'
export const QUADRANTE_LABEL: Record<Quadrante, string> = {
  D1: 'D1 · baixa competência, alta motivação',
  D2: 'D2 · competência crescente, motivação oscilante',
  D3: 'D3 · competência alta, motivação baixa',
  D4: 'D4 · alta competência e motivação (autonomia)',
}

export interface PdiPlan {
  id: string
  person_id: string
  avaliador_id: string
  cycle_id: string
  visao: string | null
  motivacao: string | null
  onde_chegar: string | null
  situacao_estagio: string | null
  disponibilidade_horas: number | null
  aspiracao: string | null
  validacao_lideranca: string | null
  pc_responsavel_id: string | null
  pdia_link: string | null
  quadrante: Quadrante | null
  foco_area: string | null
  busca_estagio: boolean
  auto_desenvolvi: string | null
  auto_nao_avancou: string | null
  auto_nota: number | null
  auto_justificativa: string | null
  auto_proximo: string | null
  auto_submetido: boolean
  lider_avaliacao_geral: string | null
  lider_nota: number | null
  lider_recomendacoes: string | null
  lider_submetido: boolean
  updated_at: string
  avaliador?: { nome: string }
  pc_responsavel?: { nome: string } | null
}
export interface PdiGoal {
  id: string
  pdi_plan_id: string
  meta: string
  status: GoalStatus
  evidencia: string | null
  criterio_sucesso: string | null
  indicador: string | null
  prazo: string | null
  competency_id: string | null
  comentario_lideranca: string | null
  fonte: string | null
}
export interface PdiCheckin {
  id: string
  pdi_plan_id: string
  lider_id: string
  data: string
  notas: string | null
  tipo: string | null
  encaminhamentos: string | null
  quadrante: Quadrante | null
  created_at: string
  lider?: { nome: string }
}
export interface Competency {
  id: string
  nome: string
  categoria: 'comportamental' | 'lideranca' | 'tecnica'
  subarea_id: string | null
  ordem: number
}
export interface CompetencyScore {
  id: string
  pdi_plan_id: string
  competency_id: string
  nota: number
  data: string
}
export interface LeadershipNotes {
  pdi_plan_id: string
  engajamento: number | null
  potencial_pdl: string | null
}
export interface Liderado {
  person_id: string | null
  email: string
  nome: string
  foto_url: string | null
  role: RoleType
  subarea_id: string
  area: string
  ativo: boolean
  pdi_id: string | null
  pdi_atualizado_em: string | null
  metas_abertas: number
  agravos: number
  risco: boolean
}

const PLAN_SELECT =
  '*, avaliador:people!pdi_plans_avaliador_id_fkey(nome), pc_responsavel:people!pdi_plans_pc_responsavel_id_fkey(nome)'

export async function getMyPdi(personId: string, cycleId: string) {
  const { data, error } = await supabase
    .from('pdi_plans')
    .select(PLAN_SELECT)
    .eq('person_id', personId)
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  return data as PdiPlan | null
}
export async function getPdiByPerson(personId: string, cycleId: string) {
  return getMyPdi(personId, cycleId)
}

export async function createPdi(personId: string, avaliadorId: string | null): Promise<string> {
  const { data, error } = await supabase
    .from('pdi_plans')
    .insert({ person_id: personId, avaliador_id: avaliadorId })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
export async function updatePlan(planId: string, patch: Partial<PdiPlan>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([key]) => key !== 'avaliador' && key !== 'pc_responsavel')
  )
  const { error } = await supabase.from('pdi_plans').update(clean).eq('id', planId)
  if (error) throw error
}
/** Compat: cria (se preciso) e salva a visão. */
export async function upsertPdi(personId: string, avaliadorId: string, visao: string, planId?: string) {
  if (planId) {
    await updatePlan(planId, { visao })
    return planId
  }
  const id = await createPdi(personId, avaliadorId)
  await updatePlan(id, { visao })
  return id
}

// ---------- Metas ----------
export async function getGoals(planId: string) {
  const { data, error } = await supabase
    .from('pdi_goals')
    .select('*')
    .eq('pdi_plan_id', planId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as PdiGoal[]
}
export async function addGoal(planId: string, patch: Partial<PdiGoal> & { meta: string }) {
  const { error } = await supabase.from('pdi_goals').insert({ pdi_plan_id: planId, ...patch })
  if (error) throw error
}
export async function updateGoal(goalId: string, patch: Partial<PdiGoal>) {
  const { error } = await supabase.from('pdi_goals').update(patch).eq('id', goalId)
  if (error) throw error
}
export async function setGoalStatus(goalId: string, status: GoalStatus, evidencia?: string) {
  const { error } = await supabase
    .from('pdi_goals')
    .update({ status, ...(evidencia !== undefined ? { evidencia } : {}) })
    .eq('id', goalId)
  if (error) throw error
}

// ---------- 1:1 ----------
export async function getCheckins(planId: string) {
  const { data, error } = await supabase
    .from('pdi_checkins')
    .select('*, lider:people!pdi_checkins_lider_id_fkey(nome)')
    .eq('pdi_plan_id', planId)
    .order('data', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as PdiCheckin[]
}
export async function addCheckin(
  planId: string,
  liderId: string,
  patch: { data: string; notas: string; tipo: string; encaminhamentos?: string; quadrante?: Quadrante },
) {
  const { error } = await supabase.from('pdi_checkins').insert({
    pdi_plan_id: planId,
    lider_id: liderId,
    data: patch.data,
    notas: patch.notas || null,
    tipo: patch.tipo,
    encaminhamentos: patch.encaminhamentos || null,
    quadrante: patch.quadrante || null,
  })
  if (error) throw error
}

// ---------- Competências ----------
export async function getCompetencies(subareaId: string | null): Promise<Competency[]> {
  const { data, error } = await supabase
    .from('competencies')
    .select('*')
    .order('categoria')
    .order('ordem')
  if (error) throw error
  const all = (data ?? []) as Competency[]
  return all.filter((c) => c.categoria !== 'tecnica' || c.subarea_id === subareaId)
}
export async function getCompetencyScores(planId: string): Promise<CompetencyScore[]> {
  const { data, error } = await supabase
    .from('pdi_competency_scores')
    .select('*')
    .eq('pdi_plan_id', planId)
    .order('data', { ascending: false })
  if (error) throw error
  return (data ?? []) as CompetencyScore[]
}
export async function setCompetencyScore(
  planId: string,
  competencyId: string,
  nota: number,
  avaliadorId: string,
) {
  const { error } = await supabase
    .from('pdi_competency_scores')
    .insert({ pdi_plan_id: planId, competency_id: competencyId, nota, avaliador_id: avaliadorId })
  if (error) throw error
}

// ---------- Notas de liderança (restritas) ----------
export async function getLeadershipNotes(planId: string): Promise<LeadershipNotes | null> {
  const { data, error } = await supabase
    .from('pdi_leadership_notes')
    .select('*')
    .eq('pdi_plan_id', planId)
    .maybeSingle()
  if (error) throw error
  return data as LeadershipNotes | null
}
export async function upsertLeadershipNotes(
  planId: string,
  patch: { engajamento?: number | null; potencial_pdl?: string | null },
) {
  const { error } = await supabase
    .from('pdi_leadership_notes')
    .upsert({ pdi_plan_id: planId, ...patch }, { onConflict: 'pdi_plan_id' })
  if (error) throw error
}

// ---------- Meus Liderados (mantido) ----------
export async function getLiderados() {
  const { data, error } = await supabase.from('liderados_view').select('*').order('nome')
  if (error) throw error
  return (data ?? []) as Liderado[]
}
