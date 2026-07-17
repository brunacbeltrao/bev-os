/**
 * Direx (Onda 1 / ADD §3.4) — atas executivas e decisões macro,
 * 100% restritas a Diretores (RLS). O Resumo/Dashboard vem da
 * direx_summary_view, acessível também a Gerentes — sem conteúdo
 * de ata nem decisões completas.
 */
import { supabase } from './supabase'

export interface DirexMinute {
  id: string
  titulo: string
  data: string
  conteudo: string // Legacy, keep for backward compatibility or migration
  pautas: string | null
  relatorio: string | null
  status: string
  criado_por: string
  cycle_id: string
  updated_at: string
}

export interface DirexDecision {
  id: string
  titulo: string
  descricao: string | null
  contexto: string | null
  problema: string | null
  alternativas: string | null
  decisao_final: string | null
  justificativa: string | null
  tipo_resolucao: string
  impactos_esperados: string | null
  revisao_prevista: string | null
  status: string
  reuniao_id: string | null
  decidido_em: string
  criado_por: string
  cycle_id: string
}

export interface DirexProblema {
  id: string
  descricao: string
  diretoria_id: string | null
  responsavel_id: string | null
  impacto: string | null
  urgencia: string
  coluna_kanban: string
  solucao_aplicada: string | null
  aprendizados: string | null
  decisao_id: string | null
  cycle_id: string
  criado_por: string
  created_at: string
}

export interface DirexTarefa {
  id: string
  titulo: string
  responsavel_id: string | null
  prazo: string | null
  status: string
  prioridade: string
  origem_tipo: string | null
  origem_id: string | null
  cycle_id: string
  criado_por: string
  created_at: string
}

export interface InboxItem {
  tipo: 'tarefa' | 'decisao' | 'problema'
  id: string
  titulo: string
  responsavel_id: string | null
  prazo: string | null
  cor: 'verde' | 'amarelo' | 'vermelho'
  cycle_id: string
}

export interface DirexSummary {
  cycle_id: string
  cycle_nome: string
  total_atas: number
  ultima_rd: string | null
  total_decisoes: number
  ultima_decisao: string | null
}

export async function getDirexSummary(cycleId: string): Promise<DirexSummary | null> {
  const { data, error } = await supabase
    .from('direx_summary_view')
    .select('*')
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  return data as DirexSummary | null
}

export async function getDirexMinutes(cycleId: string): Promise<DirexMinute[]> {
  const { data, error } = await supabase
    .from('direx_minutes')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('data', { ascending: false })
  if (error) throw error
  return (data ?? []) as DirexMinute[]
}

export async function createDirexMinute(
  titulo: string,
  data: string,
  pautas: string,
  criadoPor: string,
): Promise<void> {
  const { error } = await supabase
    .from('direx_minutes')
    .insert({ titulo, data, pautas, criado_por: criadoPor })
  if (error) throw error
}

export async function updateDirexMinute(
  id: string,
  patch: Partial<Pick<DirexMinute, 'pautas' | 'relatorio' | 'status' | 'titulo' | 'data'>>
): Promise<void> {
  const { error } = await supabase.from('direx_minutes').update(patch).eq('id', id)
  if (error) throw error
}

export async function getDirexDecisions(cycleId: string): Promise<DirexDecision[]> {
  const { data, error } = await supabase
    .from('direx_decisions')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('decidido_em', { ascending: false })
  if (error) throw error
  return (data ?? []) as DirexDecision[]
}

export async function createDirexDecision(
  titulo: string,
  descricao: string,
  criadoPor: string,
): Promise<void> {
  const { error } = await supabase
    .from('direx_decisions')
    .insert({ titulo, descricao: descricao || null, criado_por: criadoPor })
  if (error) throw error
}

export async function getInboxItems(cycleId: string): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from('view_inbox')
    .select('*')
    .eq('cycle_id', cycleId)
  if (error) throw error
  return (data ?? []) as InboxItem[]
}

export async function getDirexProblemas(cycleId: string): Promise<DirexProblema[]> {
  const { data, error } = await supabase
    .from('direx_problemas')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DirexProblema[]
}

export async function createDirexProblema(
  descricao: string,
  urgencia: string,
  diretoria_id: string | null,
  criado_por: string
): Promise<void> {
  const { error } = await supabase
    .from('direx_problemas')
    .insert({ descricao, urgencia, diretoria_id, criado_por })
  if (error) throw error
}

export async function updateProblemaStatus(id: string, coluna_kanban: string): Promise<void> {
  const { error } = await supabase
    .from('direx_problemas')
    .update({ coluna_kanban })
    .eq('id', id)
  if (error) throw error
}

export async function getDirexTarefas(cycleId: string): Promise<DirexTarefa[]> {
  const { data, error } = await supabase
    .from('direx_tarefas')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DirexTarefa[]
}

export async function createDirexTarefa(
  titulo: string,
  prioridade: string,
  prazo: string | null,
  criado_por: string
): Promise<void> {
  const { error } = await supabase
    .from('direx_tarefas')
    .insert({ titulo, prioridade, prazo, criado_por })
  if (error) throw error
}

export async function updateTarefaStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('direx_tarefas')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}
