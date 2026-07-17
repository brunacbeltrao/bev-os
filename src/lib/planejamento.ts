/** Planejamento Estratégico (Onda 4.1) — foco/propósito do ciclo +
 *  Objetivos Estratégicos com OKRs, KPIs e diretorias responsáveis.
 *  Todos leem; só a Direx edita (RLS). */
import { supabase } from './supabase'

export interface StrategicPlan {
  cycle_id: string
  foco: string
  proposito: string
}
export interface Okr {
  id: string
  objective_id: string
  texto: string
  ordem: number
}
export interface Kpi {
  id: string
  objective_id: string
  nome: string
  meta: string | null
  atual: string | null
  ordem: number
}
export interface Objective {
  id: string
  cycle_id: string
  titulo: string
  descricao: string | null
  ordem: number
  okrs: Okr[]
  kpis: Kpi[]
  directorate_ids: string[]
}
export interface Directorate {
  id: string
  nome: string
  slug: string
}

export async function getDirectorates(): Promise<Directorate[]> {
  const { data, error } = await supabase.from('directorates').select('id, nome, slug').order('nome')
  if (error) throw error
  return (data ?? []) as Directorate[]
}

export async function getPlan(cycleId: string): Promise<StrategicPlan | null> {
  const { data, error } = await supabase
    .from('strategic_plan')
    .select('*')
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  return data as StrategicPlan | null
}
export async function upsertPlan(cycleId: string, foco: string, proposito: string): Promise<void> {
  const { error } = await supabase
    .from('strategic_plan')
    .upsert({ cycle_id: cycleId, foco, proposito }, { onConflict: 'cycle_id' })
  if (error) throw error
}

export async function getObjectives(cycleId: string): Promise<Objective[]> {
  const { data, error } = await supabase
    .from('strategic_objectives')
    .select('*, okrs:objective_okrs(*), kpis:objective_kpis(*), dirs:objective_directorates(directorate_id)')
    .eq('cycle_id', cycleId)
    .order('ordem')
  if (error) throw error
  return (data ?? []).map((o: Record<string, any>) => ({
    id: o.id,
    cycle_id: o.cycle_id,
    titulo: o.titulo,
    descricao: o.descricao,
    ordem: o.ordem,
    okrs: ((o.okrs ?? []) as Okr[]).sort((a, b) => a.ordem - b.ordem),
    kpis: ((o.kpis ?? []) as Kpi[]).sort((a, b) => a.ordem - b.ordem),
    directorate_ids: ((o.dirs ?? []) as Array<{ directorate_id: string }>).map((d) => d.directorate_id),
  }))
}

export async function createObjective(cycleId: string, titulo: string, ordem: number): Promise<string> {
  const { data, error } = await supabase
    .from('strategic_objectives')
    .insert({ cycle_id: cycleId, titulo, ordem })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
export async function updateObjective(
  id: string,
  patch: Partial<Pick<Objective, 'titulo' | 'descricao'>>,
): Promise<void> {
  const { error } = await supabase.from('strategic_objectives').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteObjective(id: string): Promise<void> {
  const { error } = await supabase.from('strategic_objectives').delete().eq('id', id)
  if (error) throw error
}

export async function addOkr(objectiveId: string, texto: string, ordem: number): Promise<void> {
  const { error } = await supabase
    .from('objective_okrs')
    .insert({ objective_id: objectiveId, texto, ordem })
  if (error) throw error
}
export async function deleteOkr(id: string): Promise<void> {
  const { error } = await supabase.from('objective_okrs').delete().eq('id', id)
  if (error) throw error
}

export async function addKpi(
  objectiveId: string,
  nome: string,
  meta: string,
  atual: string,
  ordem: number,
): Promise<void> {
  const { error } = await supabase
    .from('objective_kpis')
    .insert({ objective_id: objectiveId, nome, meta: meta || null, atual: atual || null, ordem })
  if (error) throw error
}
export async function updateKpi(
  id: string,
  patch: Partial<Pick<Kpi, 'nome' | 'meta' | 'atual'>>,
): Promise<void> {
  const { error } = await supabase.from('objective_kpis').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteKpi(id: string): Promise<void> {
  const { error } = await supabase.from('objective_kpis').delete().eq('id', id)
  if (error) throw error
}

export async function setObjectiveDirectorate(
  objectiveId: string,
  directorateId: string,
  on: boolean,
): Promise<void> {
  if (on) {
    const { error } = await supabase
      .from('objective_directorates')
      .insert({ objective_id: objectiveId, directorate_id: directorateId })
    if (error && !String(error.message).includes('duplicate')) throw error
  } else {
    const { error } = await supabase
      .from('objective_directorates')
      .delete()
      .eq('objective_id', objectiveId)
      .eq('directorate_id', directorateId)
    if (error) throw error
  }
}
