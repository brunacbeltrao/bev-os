/**
 * Faturamento colaborativo (Diretoria Institucional).
 *
 * Cada colaboração é um lançamento próprio: tipo de serviço, EJ parceira,
 * valor total do contrato e valor que fica com o BEV — este último é o que
 * conta para o faturamento colaborativo. O realizado do painel é a soma
 * de `valor_bev` do ciclo; não existe mais número digitado à mão.
 *
 * Escrita liberada pelo RLS via can_edit_dir_metrics(uid, 'institucional').
 */
import { supabase } from './supabase'

export interface ColabFaturamento {
  id: string
  cycle_id: string
  servico_id: string | null
  servico_outro: string | null
  ej_parceira: string
  valor_total: number
  valor_bev: number
  fechado_por: string | null
  data_fechamento: string
  observacoes: string | null
  criado_por: string
  created_at: string
  servico: { id: string; nome: string } | null
  responsavel: { id: string; nome: string } | null
}

const SELECT =
  '*, servico:project_services(id, nome), responsavel:people!colab_faturamentos_fechado_por_fkey(id, nome)'

export async function getColabFaturamentos(cycleId: string): Promise<ColabFaturamento[]> {
  const { data, error } = await supabase
    .from('colab_faturamentos')
    .select(SELECT)
    .eq('cycle_id', cycleId)
    .order('data_fechamento', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...(r as unknown as ColabFaturamento),
    valor_total: Number((r as { valor_total: number }).valor_total),
    valor_bev: Number((r as { valor_bev: number }).valor_bev),
  }))
}

export interface ColabInput {
  cycle_id: string
  servico_id: string | null
  servico_outro: string | null
  ej_parceira: string
  valor_total: number
  valor_bev: number
  fechado_por: string | null
  data_fechamento: string
  observacoes: string | null
}

export async function createColabFaturamento(
  input: ColabInput,
  criadoPor: string,
): Promise<void> {
  const { error } = await supabase
    .from('colab_faturamentos')
    .insert({ ...input, criado_por: criadoPor })
  if (error) throw error
}

export async function deleteColabFaturamento(id: string): Promise<void> {
  const { error } = await supabase.from('colab_faturamentos').delete().eq('id', id)
  if (error) throw error
}

/** Nome do serviço, caindo para o texto livre quando for algo fora da lista. */
export function servicoLabel(c: ColabFaturamento): string {
  return c.servico?.nome ?? c.servico_outro ?? 'Serviço não informado'
}

export interface ColabResumo {
  realizado: number
  valorContratado: number
  parceiros: number
  lancamentos: number
}

export function resumirColab(rows: ColabFaturamento[]): ColabResumo {
  return {
    realizado: rows.reduce((s, r) => s + r.valor_bev, 0),
    valorContratado: rows.reduce((s, r) => s + r.valor_total, 0),
    parceiros: new Set(rows.map((r) => r.ej_parceira.trim().toLowerCase())).size,
    lancamentos: rows.length,
  }
}
