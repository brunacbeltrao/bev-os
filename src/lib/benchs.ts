/** Benchs (Onda 3 / ADD §3.10) — benchmarks com outras EJs/profissionais. */
import { supabase } from './supabase'

export interface Bench {
  id: string
  subarea_id: string
  organizacao_parceira: string
  data: string
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
  data: string
  criado_por: string
  gravacao_url?: string
}) {
  const { error } = await supabase
    .from('benchs')
    .insert({ ...input, gravacao_url: input.gravacao_url || null })
  if (error) throw error
}
export async function setBenchInsights(id: string, insights: string, gravacaoUrl?: string) {
  const { error } = await supabase
    .from('benchs')
    .update({ insights, ...(gravacaoUrl !== undefined ? { gravacao_url: gravacaoUrl || null } : {}) })
    .eq('id', id)
  if (error) throw error
}
