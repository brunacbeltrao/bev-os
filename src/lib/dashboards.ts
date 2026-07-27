/** Dashboards consolidados (Onda 4). Views agregadas + reúso das
 *  libs existentes. Cada view já é escopada por papel no próprio SQL. */
import { supabase } from './supabase'

export interface EntregaRow {
  subarea_id: string
  area: string
  directorate_id: string
  total: number
  concluidas: number
}
export interface WarningRow {
  directorate_id: string
  diretoria: string
  agravos: number
  probatorios: number
}

export async function getEntrega(): Promise<EntregaRow[]> {
  const { data, error } = await supabase.from('dashboard_entrega').select('*').order('area')
  if (error) throw error
  return (data ?? []) as EntregaRow[]
}

/** Retorna [] quando o usuário não tem permissão (view filtra por papel). */
export async function getWarningsDash(): Promise<WarningRow[]> {
  const { data, error } = await supabase.from('dashboard_warnings').select('*').order('diretoria')
  if (error) throw error
  return (data ?? []) as WarningRow[]
}

// ============================================================
// Dashboard por diretoria (2026.2) — agregados via RPC + KPIs editáveis.
// ============================================================

// ---------- Permissão de edição por diretoria (espelha o RLS) ----------
export type DirSlug = 'negocios' | 'projetos' | 'gestao' | 'pessoas_cultura' | 'institucional'

/** ---------- Agregados (funções security definer) ---------- */
export interface FinResumo {
  saldo: number
  entradas: number
  saidas: number
}
export async function getDashFinanceiro(): Promise<FinResumo> {
  const { data, error } = await supabase.rpc('dashboard_financeiro')
  if (error) throw error
  const r = (data ?? [])[0] as FinResumo | undefined
  return r ?? { saldo: 0, entradas: 0, saidas: 0 }
}

export interface NegResumo {
  ticket_medio: number
  conversao: number
  fechados: number
  total: number
}
export async function getDashNegocios(): Promise<NegResumo> {
  const { data, error } = await supabase.rpc('dashboard_negocios')
  if (error) throw error
  const r = (data ?? [])[0] as NegResumo | undefined
  return r ?? { ticket_medio: 0, conversao: 0, fechados: 0, total: 0 }
}

export interface PdiResumo {
  abertos: number
  concluidos: number
  em_risco: number
}
export async function getDashPdi(): Promise<PdiResumo> {
  const { data, error } = await supabase.rpc('dashboard_pdi')
  if (error) throw error
  const r = (data ?? [])[0] as PdiResumo | undefined
  return r ?? { abertos: 0, concluidos: 0, em_risco: 0 }
}

export interface ProjResumo {
  total: number
  sem_servico: number
  sem_nucleo: number
}
export async function getDashProjResumo(): Promise<ProjResumo> {
  const { data, error } = await supabase.rpc('dashboard_projetos_resumo')
  if (error) throw error
  const r = (data ?? [])[0] as ProjResumo | undefined
  return r ?? { total: 0, sem_servico: 0, sem_nucleo: 0 }
}

export interface BreakdownRow {
  nome: string
  total: number
}
export async function getDashProjServico(): Promise<BreakdownRow[]> {
  const { data, error } = await supabase.rpc('dashboard_projetos_servico')
  if (error) throw error
  return ((data ?? []) as Array<{ nome: string; total: number }>).map((r) => ({
    nome: r.nome,
    total: r.total,
  }))
}
export async function getDashProjNucleo(): Promise<BreakdownRow[]> {
  const { data, error } = await supabase.rpc('dashboard_projetos_nucleo')
  if (error) throw error
  return ((data ?? []) as Array<{ nome: string; total: number }>).map((r) => ({
    nome: r.nome,
    total: r.total,
  }))
}

/** ---------- Faturamento mensal Brasil Júnior ----------
 *  `realizado_contratos` = soma ACUMULADA dos contratos fechados do ano
 *  (fonte automática). `realizado_manual` é um ajuste opcional que, quando
 *  preenchido, prevalece — serve para casar com o número oficial da BJ.
 */
export interface FatMes {
  ano: number
  mes: number
  meta: number
  realizado_manual: number | null
  realizado_contratos: number
  /** valor efetivamente exibido: ajuste manual quando houver, senão contratos */
  realizado: number | null
}

export async function getFaturamentoMensal(ano: number): Promise<FatMes[]> {
  const { data, error } = await supabase.rpc('faturamento_ano', { p_ano: ano })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const manual = r.realizado_manual == null ? null : Number(r.realizado_manual)
    const contratos = Number(r.realizado_contratos ?? 0)
    return {
      ano: Number(r.ano),
      mes: Number(r.mes),
      meta: Number(r.meta ?? 0),
      realizado_manual: manual,
      realizado_contratos: contratos,
      realizado: manual ?? (contratos > 0 ? contratos : null),
    }
  })
}

/** Grava o ajuste manual do mês. Faz UPDATE (a linha meta/mês já existe);
 *  se ainda não existir, cria com meta 0 para não violar o NOT NULL. */
export async function setFaturamentoRealizado(
  ano: number,
  mes: number,
  realizado: number | null,
): Promise<void> {
  const { data, error } = await supabase
    .from('faturamento_mensal')
    .update({ realizado })
    .eq('ano', ano)
    .eq('mes', mes)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    const { error: insErr } = await supabase
      .from('faturamento_mensal')
      .insert({ ano, mes, meta: 0, realizado })
    if (insErr) throw insErr
  }
}

/** Atualiza a meta acumulada de um mês (Brasil Júnior). */
export async function setFaturamentoMeta(ano: number, mes: number, meta: number): Promise<void> {
  const { data, error } = await supabase
    .from('faturamento_mensal')
    .update({ meta })
    .eq('ano', ano)
    .eq('mes', mes)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) {
    const { error: insErr } = await supabase
      .from('faturamento_mensal')
      .insert({ ano, mes, meta })
    if (insErr) throw insErr
  }
}

/** ---------- KPIs editáveis por diretoria (uma linha por ciclo) ---------- */
export interface NegInd {
  ticket_medio_meta: number
  conversao_meta: number
}
export async function getNegInd(cycleId: string): Promise<NegInd> {
  const { data, error } = await supabase
    .from('negocios_indicadores')
    .select('ticket_medio_meta, conversao_meta')
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  return (data as NegInd) ?? { ticket_medio_meta: 2800, conversao_meta: 0.4 }
}
export async function saveNegInd(cycleId: string, patch: NegInd): Promise<void> {
  const { error } = await supabase
    .from('negocios_indicadores')
    .upsert({ cycle_id: cycleId, ...patch }, { onConflict: 'cycle_id' })
  if (error) throw error
}

export interface FinMeta {
  reserva_minima: number
}
export async function getFinMeta(cycleId: string): Promise<FinMeta> {
  const { data, error } = await supabase
    .from('financeiro_meta')
    .select('reserva_minima')
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  return (data as FinMeta) ?? { reserva_minima: 0 }
}
export async function saveFinMeta(cycleId: string, patch: FinMeta): Promise<void> {
  const { error } = await supabase
    .from('financeiro_meta')
    .upsert({ cycle_id: cycleId, ...patch }, { onConflict: 'cycle_id' })
  if (error) throw error
}

export interface PcInd {
  enps: number | null
}
export async function getPcInd(cycleId: string): Promise<PcInd> {
  const { data, error } = await supabase
    .from('pc_indicadores')
    .select('enps')
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  return (data as PcInd) ?? { enps: null }
}
export async function savePcInd(cycleId: string, patch: PcInd): Promise<void> {
  const { error } = await supabase
    .from('pc_indicadores')
    .upsert({ cycle_id: cycleId, ...patch }, { onConflict: 'cycle_id' })
  if (error) throw error
}

export interface InstInd {
  /** Legado: o realizado agora vem da soma dos lançamentos em colab_faturamentos. */
  colab_realizado: number
  colab_meta: number
  colab_ej: number
  colab_ej_meta: number
  colab_agentes: number
  colab_agentes_meta: number
  superavit: number
  engajamento_mej: number | null
}
const INST_DEFAULT: InstInd = {
  colab_realizado: 0,
  colab_meta: 21475.95,
  colab_ej: 0,
  colab_ej_meta: 1,
  colab_agentes: 0,
  colab_agentes_meta: 2,
  superavit: -18199.96,
  engajamento_mej: null,
}
export async function getInstInd(cycleId: string): Promise<InstInd> {
  const { data, error } = await supabase
    .from('institucional_indicadores')
    .select('*')
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  return (data as InstInd) ?? INST_DEFAULT
}
export async function saveInstInd(cycleId: string, patch: InstInd): Promise<void> {
  const { error } = await supabase
    .from('institucional_indicadores')
    .upsert({ cycle_id: cycleId, ...patch }, { onConflict: 'cycle_id' })
  if (error) throw error
}

export interface BevInd {
  csat: number | null
}
export async function getBevInd(cycleId: string): Promise<BevInd> {
  const { data, error } = await supabase
    .from('bev_indicadores')
    .select('csat')
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  return (data as BevInd) ?? { csat: null }
}
export async function saveBevInd(cycleId: string, patch: BevInd): Promise<void> {
  const { error } = await supabase
    .from('bev_indicadores')
    .upsert({ cycle_id: cycleId, ...patch }, { onConflict: 'cycle_id' })
  if (error) throw error
}
