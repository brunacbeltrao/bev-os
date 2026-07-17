/** Warnings (Onda 3 / ADD §3.8) — visível ao titular e à P&C. */
import { supabase } from './supabase'

export type FlagCor = 'branca' | 'amarela' | 'vermelha' | 'preta'
export const FLAG_LABELS: Record<FlagCor, string> = {
  branca: 'Branca',
  amarela: 'Amarela',
  vermelha: 'Vermelha',
  preta: 'Preta',
}
export const FLAG_BADGE: Record<FlagCor, 'neutral' | 'warning' | 'danger'> = {
  branca: 'neutral',
  amarela: 'warning',
  vermelha: 'danger',
  preta: 'danger',
}
export interface WarningFlag {
  id: string
  cor: FlagCor
  pontos: number
}
export interface Warning {
  id: string
  person_id: string
  justificativa: string
  created_at: string
  flag: WarningFlag
  pessoa?: { nome: string }
  aplicador?: { nome: string }
}
export interface WarningTotal {
  person_id: string
  cycle_id: string
  pontos: number
  agravos: number
}

export async function getFlags() {
  const { data, error } = await supabase.from('warning_flags').select('*').order('pontos')
  if (error) throw error
  return (data ?? []) as WarningFlag[]
}
export async function getWarnings(cycleId: string) {
  const { data, error } = await supabase
    .from('warnings')
    .select(
      '*, flag:warning_flags(id, cor, pontos), pessoa:people!warnings_person_id_fkey(nome), aplicador:people!warnings_aplicado_por_fkey(nome)',
    )
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Warning[]
}
export async function getTotals(cycleId: string) {
  const { data, error } = await supabase
    .from('person_warning_totals')
    .select('*')
    .eq('cycle_id', cycleId)
  if (error) throw error
  return (data ?? []) as WarningTotal[]
}
export async function getMyProbation(personId: string, cycleId: string) {
  const { data, error } = await supabase
    .from('probation_periods')
    .select('*')
    .eq('person_id', personId)
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  return data as { status: 'em_andamento' | 'sucesso' | 'desligamento' } | null
}
export async function applyWarning(personId: string, flagId: string, justificativa: string, aplicadoPor: string) {
  const { error } = await supabase
    .from('warnings')
    .insert({ person_id: personId, flag_id: flagId, justificativa, aplicado_por: aplicadoPor })
  if (error) throw error
}
