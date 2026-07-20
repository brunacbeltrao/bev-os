/**
 * Contratos fechados (Diretoria de Negócios).
 * Fonte de verdade do faturamento: o realizado mensal do painel é a
 * soma acumulada dos contratos do ano (RPC `faturamento_ano`).
 * Escrita liberada pelo RLS via can_edit_dir_metrics(uid,'negocios').
 */
import { supabase } from './supabase'

export type ContratoSegmento = 'pme' | 'ej' | 'atletica' | 'governo' | 'ies' | 'outro'

export const SEGMENTO_CONTRATO_LABELS: Record<ContratoSegmento, string> = {
  pme: 'PME',
  ej: 'Empresa Júnior',
  atletica: 'Atlética',
  governo: 'Governo',
  ies: 'IES',
  outro: 'Outro',
}

export interface Contrato {
  id: string
  cycle_id: string
  cliente: string
  valor: number
  data_fechamento: string
  servico_id: string | null
  responsavel_id: string | null
  segmento: ContratoSegmento
  observacoes: string | null
  criado_por: string
  created_at: string
  servico: { id: string; nome: string } | null
  responsavel: { id: string; nome: string } | null
}

const SELECT =
  '*, servico:project_services(id, nome), responsavel:people!contratos_responsavel_id_fkey(id, nome)'

/** Contratos de um ano-calendário, do mais recente para o mais antigo. */
export async function getContratos(ano: number): Promise<Contrato[]> {
  const { data, error } = await supabase
    .from('contratos')
    .select(SELECT)
    .gte('data_fechamento', `${ano}-01-01`)
    .lte('data_fechamento', `${ano}-12-31`)
    .order('data_fechamento', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Contrato[]
}

export interface ContratoInput {
  cliente: string
  valor: number
  data_fechamento: string
  servico_id?: string | null
  responsavel_id?: string | null
  segmento: ContratoSegmento
  observacoes?: string | null
}

export async function createContrato(input: ContratoInput, criadoPor: string): Promise<void> {
  const { error } = await supabase.from('contratos').insert({
    ...input,
    servico_id: input.servico_id || null,
    responsavel_id: input.responsavel_id || null,
    observacoes: input.observacoes || null,
    criado_por: criadoPor,
  })
  if (error) throw error
}

export async function updateContrato(id: string, patch: Partial<ContratoInput>): Promise<void> {
  const { error } = await supabase.from('contratos').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteContrato(id: string): Promise<void> {
  const { error } = await supabase.from('contratos').delete().eq('id', id)
  if (error) throw error
}

export interface ServicoOption {
  id: string
  nome: string
}
export async function getServicos(): Promise<ServicoOption[]> {
  const { data, error } = await supabase
    .from('project_services')
    .select('id, nome')
    .order('ordem')
  if (error) throw error
  return (data ?? []) as ServicoOption[]
}
