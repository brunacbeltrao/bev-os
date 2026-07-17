/**
 * Comercial (Onda 2 / ADD §3.5) — funil herdado do Bevilaqua
 * Connect, sem a camada de gamificação (decisão de escopo do PRD).
 * Regras (fechado exige valor; perdido exige motivo) vivem em
 * trigger no banco; a trilha de etapas é registrada automaticamente.
 */
import { supabase } from './supabase'
import type { Person } from './org'

export type LeadEtapa =
  | 'qualificacao'
  | 'prospeccao'
  | 'reuniao'
  | 'proposta'
  | 'negociacao'
  | 'fechado'
  | 'perdido'

export const ETAPAS_ORDEM: LeadEtapa[] = [
  'qualificacao',
  'prospeccao',
  'reuniao',
  'proposta',
  'negociacao',
  'fechado',
  'perdido',
]

export const ETAPA_LABELS: Record<LeadEtapa, string> = {
  qualificacao: 'Qualificação',
  prospeccao: 'Prospecção',
  reuniao: 'Reunião',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado: 'Fechado',
  perdido: 'Perdido',
}

export type LeadSegmento = 'pme' | 'ej' | 'atletica' | 'outro'

export const SEGMENTO_LABELS: Record<LeadSegmento, string> = {
  pme: 'PME',
  ej: 'EJ',
  atletica: 'Atlética',
  outro: 'Outro',
}

export interface Lead {
  id: string
  nome_cliente: string
  assessor_responsavel_id: string
  etapa_atual: LeadEtapa
  segmento: LeadSegmento
  valor_fechado: number | null
  servicos_vendidos: string[] | null
  motivo_perda: string | null
  criado_por: string
  cycle_id: string
  created_at: string
  updated_at: string
  assessor: Pick<Person, 'id' | 'nome' | 'foto_url'>
}

const LEAD_SELECT = '*, assessor:people!leads_assessor_responsavel_id_fkey(id, nome, foto_url)'

export async function getLeads(cycleId: string): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select(LEAD_SELECT)
    .eq('cycle_id', cycleId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Lead[]
}

export async function createLead(input: {
  nome_cliente: string
  segmento: LeadSegmento
  assessor_responsavel_id: string
  criado_por: string
}): Promise<void> {
  const { error } = await supabase.from('leads').insert(input)
  if (error) throw error
}

export interface LeadPatch {
  etapa_atual?: LeadEtapa
  nome_cliente?: string
  segmento?: LeadSegmento
  assessor_responsavel_id?: string
  valor_fechado?: number | null
  servicos_vendidos?: string[] | null
  motivo_perda?: string | null
}

export async function updateLead(leadId: string, patch: LeadPatch): Promise<void> {
  const { error } = await supabase.from('leads').update(patch).eq('id', leadId)
  if (error) throw error
}

export function leadErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('BEV_OS_LEAD_FECHADO_SEM_VALOR'))
    return 'Para fechar o lead, informe o valor fechado.'
  if (msg.includes('BEV_OS_LEAD_PERDIDO_SEM_MOTIVO'))
    return 'Para marcar como perdido, informe o motivo da perda.'
  return 'Não foi possível atualizar o lead. Verifique suas permissões.'
}

export function fmtValor(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
