/**
 * Demandas (Onda 1 / ADD §3.1) — demandas internas de gestão de área.
 * Regras de negócio (entregável para revisão; conclusão só pela
 * liderança) são aplicadas no banco via trigger — a UI apenas reflete.
 */
import { supabase } from './supabase'
import type { Person } from './org'
import { checkDemandLeadership } from '@/server/validations'
import type { DemandaFormValues } from './validations/demandas'

export type DemandStatus = 'a_fazer' | 'em_andamento' | 'em_revisao' | 'concluido'

export const DEMAND_STATUS_LABELS: Record<DemandStatus, string> = {
  a_fazer: 'A Fazer',
  em_andamento: 'Em Andamento',
  em_revisao: 'Em Revisão',
  concluido: 'Concluído',
}

export const DEMAND_STATUS_ORDER: DemandStatus[] = [
  'a_fazer',
  'em_andamento',
  'em_revisao',
  'concluido',
]

export interface Demand {
  id: string
  titulo: string
  descricao: string | null
  tipo: string | null
  subarea_id: string
  status: DemandStatus
  prazo: string | null
  entregavel_url: string | null
  criado_por: string
  cycle_id: string
  created_at: string
  updated_at: string
  assignees: Array<Pick<Person, 'id' | 'nome' | 'foto_url'>>
}

export interface DemandComment {
  id: string
  demand_id: string
  autor_id: string
  texto: string
  created_at: string
  autor: Pick<Person, 'id' | 'nome' | 'foto_url'>
}

const DEMAND_SELECT =
  '*, demand_assignees(person:people(id, nome, foto_url))'

function mapDemand(row: Record<string, unknown>): Demand {
  const assignees = ((row.demand_assignees as Array<{ person: Demand['assignees'][number] }>) ?? []).map(
    (a) => a.person,
  )
  return { ...(row as unknown as Omit<Demand, 'assignees'>), assignees }
}

export async function getDemands(subareaIds: string[] | null, cycleId: string): Promise<Demand[]> {
  let query = supabase
    .from('demands')
    .select(DEMAND_SELECT)
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
  if (subareaIds && subareaIds.length > 0) query = query.in('subarea_id', subareaIds)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => mapDemand(r as Record<string, unknown>))
}

/** Demandas em que sou responsável e ainda não concluídas (Inbox). */
export async function getMyDemands(personId: string, cycleId: string): Promise<Demand[]> {
  const { data: links, error: linkErr } = await supabase
    .from('demand_assignees')
    .select('demand_id')
    .eq('person_id', personId)
  if (linkErr) throw linkErr
  const ids = (links ?? []).map((l) => l.demand_id)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('demands')
    .select(DEMAND_SELECT)
    .in('id', ids)
    .eq('cycle_id', cycleId)
    .neq('status', 'concluido')
    .order('prazo', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []).map((r) => mapDemand(r as Record<string, unknown>))
}

/** Todas as demandas de uma pessoa no ciclo (para o painel de liderança). */
export async function getDemandsByPerson(personId: string, cycleId: string): Promise<Demand[]> {
  const { data: links, error: linkErr } = await supabase
    .from('demand_assignees')
    .select('demand_id')
    .eq('person_id', personId)
  if (linkErr) throw linkErr
  const ids = (links ?? []).map((l) => l.demand_id)
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('demands')
    .select(DEMAND_SELECT)
    .in('id', ids)
    .eq('cycle_id', cycleId)
    .order('prazo', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []).map((r) => mapDemand(r as Record<string, unknown>))
}

/** Demandas em revisão nas subáreas que eu lidero (aprovações pendentes). */
export async function getPendingApprovals(subareaIds: string[], cycleId: string): Promise<Demand[]> {
  if (subareaIds.length === 0) return []
  const { data, error } = await supabase
    .from('demands')
    .select(DEMAND_SELECT)
    .in('subarea_id', subareaIds)
    .eq('cycle_id', cycleId)
    .eq('status', 'em_revisao')
    .order('updated_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => mapDemand(r as Record<string, unknown>))
}

export async function createDemand(input: DemandaFormValues & { criado_por: string }): Promise<string> {
  const { data, error } = await supabase
    .from('demands')
    .insert({
      titulo: input.titulo,
      descricao: input.descricao || null,
      tipo: input.tipo || null,
      subarea_id: input.subarea_id,
      prazo: input.prazo || null,
      criado_por: input.criado_por,
    })
    .select('id')
    .single()
  if (error) throw error
  if (input.assignees.length > 0) {
    const { error: aErr } = await supabase
      .from('demand_assignees')
      .insert(input.assignees.map((person_id) => ({ demand_id: data.id, person_id })))
    if (aErr) throw aErr
  }
  return data.id
}

export async function updateDemandStatus(
  demandId: string,
  status: DemandStatus,
  role: string,
  entregavelUrl?: string,
): Promise<void> {
  // Executa validação no servidor (baseado no System Settings e Regimento Interno)
  await checkDemandLeadership(role, status)

  const patch: Record<string, unknown> = { status }
  if (entregavelUrl !== undefined) patch.entregavel_url = entregavelUrl || null
  const { error } = await supabase.from('demands').update(patch).eq('id', demandId)
  if (error) throw error
}

export async function getDemandComments(demandId: string): Promise<DemandComment[]> {
  const { data, error } = await supabase
    .from('demand_comments')
    .select('*, autor:people(id, nome, foto_url)')
    .eq('demand_id', demandId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as DemandComment[]
}

export async function addDemandComment(demandId: string, autorId: string, texto: string): Promise<void> {
  const { error } = await supabase
    .from('demand_comments')
    .insert({ demand_id: demandId, autor_id: autorId, texto })
  if (error) throw error
}

/** Traduz erros do trigger para mensagens amigáveis. */
export function demandErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('BEV_OS_DEMANDA_SEM_ENTREGAVEL'))
    return 'Para enviar à revisão, anexe o link do entregável.'
  if (msg.includes('BEV_OS_DEMANDA_LIDERANCA'))
    return 'Apenas a liderança da área pode concluir uma demanda.'
  return 'Não foi possível atualizar a demanda. Tente novamente.'
}
