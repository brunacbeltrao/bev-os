/** Financeiro (Onda 4 / ADD §3.11) — caixa único institucional.
 *  Todos leem; Gestão + Direx lançam (RLS). */
import { supabase } from './supabase'

export type FinanceTipo = 'entrada' | 'saida'

export interface FinanceEntry {
  id: string
  tipo: FinanceTipo
  valor: number
  descricao: string
  data: string
  subarea_id: string | null
  cycle_id: string
  subarea?: { nome: string } | null
}
export interface FinanceSummary {
  entradas: number
  saidas: number
  saldo: number
}

export function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function getFinanceEntries(cycleId: string): Promise<FinanceEntry[]> {
  const { data, error } = await supabase
    .from('finance_entries')
    .select('id, tipo, valor, descricao, data, subarea_id, cycle_id, subarea:subareas(nome)')
    .eq('cycle_id', cycleId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((e: Record<string, any>) => ({ ...e, valor: Number(e.valor) })) as FinanceEntry[]
}

export function summarize(entries: FinanceEntry[]): FinanceSummary {
  let entradas = 0
  let saidas = 0
  for (const e of entries) {
    if (e.tipo === 'entrada') entradas += e.valor
    else saidas += e.valor
  }
  return { entradas, saidas, saldo: entradas - saidas }
}

export interface NewFinanceEntry {
  tipo: FinanceTipo
  valor: number
  descricao: string
  data: string
  subarea_id: string | null
  aprovado_por: string
}
export async function createFinanceEntry(input: NewFinanceEntry): Promise<void> {
  const { error } = await supabase.from('finance_entries').insert({
    tipo: input.tipo,
    valor: input.valor,
    descricao: input.descricao,
    data: input.data,
    subarea_id: input.subarea_id,
    aprovado_por: input.aprovado_por,
  })
  if (error) throw error
}
export async function deleteFinanceEntry(id: string): Promise<void> {
  const { error } = await supabase.from('finance_entries').delete().eq('id', id)
  if (error) throw error
}
