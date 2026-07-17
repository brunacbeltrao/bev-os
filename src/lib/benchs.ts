/** Benchs (Onda 3 / ADD §3.10) — benchmarks com outras EJs/profissionais. */
import { supabase } from './supabase'

export interface Bench {
  id: string
  subarea_id: string
  organizacao_parceira: string // Agora é a EJ do membro
  membro_nome: string
  membro_email: string
  tema: string
  data: string // Será a data/hora do meet
  meet_url: string | null
  insights: string | null
  gravacao_url: string | null
  criado_por: string
  created_at: string
}

export async function getBenchs(cycleId: string, subareaIds: string[] | null) {
  let q = supabase.from('benchs').select('*').eq('cycle_id', cycleId).order('data', { ascending: false })
  if (subareaIds && subareaIds.length > 0) q = q.in('subarea_id', subareaIds)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Bench[]
}
export async function createBench(input: {
  subarea_id: string
  organizacao_parceira: string
  membro_nome: string
  membro_email: string
  tema: string
  data: string
  criado_por: string
  meet_url?: string
}) {
  const { error } = await supabase
    .from('benchs')
    .insert({ ...input, meet_url: input.meet_url || null })
  if (error) throw error
}
export async function setBenchInsights(id: string, insights: string, gravacaoUrl?: string) {
  const { error } = await supabase
    .from('benchs')
    .update({ insights, ...(gravacaoUrl !== undefined ? { gravacao_url: gravacaoUrl || null } : {}) })
    .eq('id', id)
  if (error) throw error
}
