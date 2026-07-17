/** Planejamento Estratégico (Onda 4.1) — foco/propósito do ciclo +
 *  Objetivos Estratégicos com OKRs, KPIs e diretorias responsáveis.
 *  Todos leem; só a Direx edita (RLS). */
import { supabase } from './supabase'
import { z } from 'zod'

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

const ObjectiveSchema = z.object({
  id: z.string(),
  cycle_id: z.string(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  ordem: z.number(),
  okrs: z.array(z.object({ id: z.string(), objective_id: z.string(), texto: z.string(), ordem: z.number() })).optional().default([]),
  kpis: z.array(z.object({ id: z.string(), objective_id: z.string(), nome: z.string(), meta: z.string().nullable(), atual: z.string().nullable(), ordem: z.number() })).optional().default([]),
  dirs: z.array(z.object({ directorate_id: z.string() })).optional().default([]),
})

export async function getObjectives(cycleId: string): Promise<Objective[]> {
  const { data, error } = await supabase
    .from('strategic_objectives')
    .select('*, okrs:objective_okrs(*), kpis:objective_kpis(*), dirs:objective_directorates(directorate_id)')
    .eq('cycle_id', cycleId)
    .order('ordem')
  if (error) throw error
  
  return (data ?? []).map((row) => {
    const o = ObjectiveSchema.parse(row)
    return {
      id: o.id,
      cycle_id: o.cycle_id,
      titulo: o.titulo,
      descricao: o.descricao,
      ordem: o.ordem,
      okrs: o.okrs.sort((a, b) => a.ordem - b.ordem),
      kpis: o.kpis.sort((a, b) => a.ordem - b.ordem),
      directorate_ids: o.dirs.map((d) => d.directorate_id),
    }
  })
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
