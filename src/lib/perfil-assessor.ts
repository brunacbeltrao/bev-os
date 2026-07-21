/**
 * Perfil do Assessor (PRD v1.0) — a tela que abre quando a liderança
 * clica em alguém em "Meus Liderados". 1 Header Fixo + 3 Abas:
 *   1. Entregas e Competências
 *   2. Diário de Liderança
 *   3. Encerramento de Ciclo
 *
 * É uma VIEW sobre os módulos existentes (Demandas, Warnings, Agenda,
 * PDI) — nada é duplicado. Só o que é novo mora em tabelas próprias:
 * leadership_entries, entregas_avulsas, competency_faroles e
 * cycle_endorsements.
 */
import { supabase } from './supabase'
import type { RoleType, Subarea, Directorate } from './org'

// ---------- Faróis ----------

export type Farol = 'verde' | 'amarelo' | 'vermelho'

export const FAROL_LABEL: Record<Farol, string> = {
  verde: 'Bem',
  amarelo: 'Atenção',
  vermelho: 'Crítico',
}
export const FAROL_DOT: Record<Farol, string> = {
  verde: 'bg-status-success',
  amarelo: 'bg-status-warning',
  vermelho: 'bg-status-danger',
}
export const FAROL_BADGE: Record<Farol, 'success' | 'warning' | 'danger'> = {
  verde: 'success',
  amarelo: 'warning',
  vermelho: 'danger',
}

// ---------- Header ----------

export interface PerfilOccupation {
  id: string
  role: RoleType
  is_hibrido: boolean
  subarea: Pick<Subarea, 'id' | 'slug' | 'nome'>
  directorate: Pick<Directorate, 'id' | 'slug' | 'nome'>
}

export interface PerfilPessoa {
  id: string
  nome: string
  email: string
  foto_url: string | null
  entrou_em: string
  occupations: PerfilOccupation[]
}

export async function getPerfilPessoa(personId: string, cycleId: string): Promise<PerfilPessoa> {
  const [pessoa, occs] = await Promise.all([
    supabase.from('people').select('id, nome, email, foto_url, entrou_em').eq('id', personId).single(),
    supabase
      .from('occupations')
      .select(
        'id, role, is_hibrido, subarea:subareas(id, slug, nome), directorate:directorates(id, slug, nome)',
      )
      .eq('person_id', personId)
      .eq('cycle_id', cycleId),
  ])
  if (pessoa.error) throw pessoa.error
  if (occs.error) throw occs.error
  return {
    ...(pessoa.data as Omit<PerfilPessoa, 'occupations'>),
    occupations: (occs.data ?? []) as unknown as PerfilOccupation[],
  }
}

/** Nº de ciclos em que a pessoa teve vínculo (tempo de casa em ciclos). */
export async function getCiclosNoBev(personId: string): Promise<number> {
  const { data, error } = await supabase
    .from('occupations')
    .select('cycle_id')
    .eq('person_id', personId)
  if (error) throw error
  return new Set((data ?? []).map((o) => o.cycle_id)).size
}

// ---------- Elegibilidade ao Banco de Talentos ----------

export interface CriterioTalento {
  chave: string
  ok: boolean
  label: string
  detalhe: string
}
export interface Elegibilidade {
  elegivel: boolean
  override: boolean
  override_motivo: string | null
  criterios: CriterioTalento[]
}

export async function getElegibilidade(personId: string, cycleId: string): Promise<Elegibilidade> {
  const { data, error } = await supabase.rpc('talento_elegibilidade', {
    p_person: personId,
    p_cycle: cycleId,
  })
  if (error) throw error
  return data as Elegibilidade
}

// ---------- Bandeira (Warnings) ----------

export interface Bandeira {
  cor: 'branca' | 'amarela' | 'vermelha' | 'preta'
  advertencias: number
  agravos: number
}

export async function getBandeira(personId: string, cycleId: string): Promise<Bandeira> {
  const { data, error } = await supabase.rpc('perfil_bandeira', {
    p_person: personId,
    p_cycle: cycleId,
  })
  if (error) throw error
  return data as Bandeira
}

// ---------- Aba 1: Entregas ----------

export type ClasseEntrega = 'no_prazo' | 'com_atraso' | 'em_aberto'

export const CLASSE_LABEL: Record<ClasseEntrega, string> = {
  no_prazo: 'Concluídas no prazo',
  com_atraso: 'Concluídas com atraso',
  em_aberto: 'Em aberto ou atrasadas',
}
export const CLASSE_FAROL: Record<ClasseEntrega, Farol> = {
  no_prazo: 'verde',
  com_atraso: 'amarelo',
  em_aberto: 'vermelho',
}

export interface PerfilDemanda {
  id: string
  titulo: string
  status: string
  prazo: string | null
  atualizada_em: string
  classe: ClasseEntrega
}

export async function getPerfilDemandas(
  personId: string,
  cycleId: string,
): Promise<PerfilDemanda[]> {
  const { data, error } = await supabase.rpc('perfil_demandas', {
    p_person: personId,
    p_cycle: cycleId,
  })
  if (error) throw error
  return (data ?? []) as PerfilDemanda[]
}

export interface EntregaAvulsa {
  id: string
  person_id: string
  titulo: string
  data: string
  qualidade: Farol
  observacao: string | null
  autor?: { nome: string } | null
}

export async function getEntregasAvulsas(
  personId: string,
  cycleId: string,
): Promise<EntregaAvulsa[]> {
  const { data, error } = await supabase
    .from('entregas_avulsas')
    .select('*, autor:people!entregas_avulsas_autor_id_fkey(nome)')
    .eq('person_id', personId)
    .eq('cycle_id', cycleId)
    .order('data', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as EntregaAvulsa[]
}

export async function addEntregaAvulsa(input: {
  person_id: string
  cycle_id: string
  autor_id: string
  titulo: string
  data: string
  qualidade: Farol
  observacao?: string
}): Promise<void> {
  const { error } = await supabase.from('entregas_avulsas').insert({
    ...input,
    observacao: input.observacao?.trim() || null,
  })
  if (error) throw error
}

export async function removeEntregaAvulsa(id: string): Promise<void> {
  const { error } = await supabase.from('entregas_avulsas').delete().eq('id', id)
  if (error) throw error
}

// ---------- Aba 1: Competências (faróis + divergência 360°) ----------

export interface FarolCompetencia {
  id: string
  competency_id: string
  farol_lider: Farol | null
  farol_auto: Farol | null
}

export async function getFaroles(
  personId: string,
  cycleId: string,
  mes: number,
  ano: number,
): Promise<FarolCompetencia[]> {
  const { data, error } = await supabase
    .from('competency_faroles')
    .select('id, competency_id, farol_lider, farol_auto')
    .eq('person_id', personId)
    .eq('cycle_id', cycleId)
    .eq('mes', mes)
    .eq('ano', ano)
  if (error) throw error
  return (data ?? []) as FarolCompetencia[]
}

export async function setFarol(input: {
  person_id: string
  cycle_id: string
  competency_id: string
  mes: number
  ano: number
  campo: 'farol_lider' | 'farol_auto'
  valor: Farol | null
}): Promise<void> {
  const { person_id, cycle_id, competency_id, mes, ano, campo, valor } = input
  const { error } = await supabase.from('competency_faroles').upsert(
    { person_id, cycle_id, competency_id, mes, ano, [campo]: valor },
    { onConflict: 'person_id,cycle_id,competency_id,mes,ano' },
  )
  if (error) throw error
}

// ---------- Aba 2: Diário de Liderança ----------

export type TipoInteracao = 'one_on_one' | 'reconhecimento' | 'acompanhamento'

export const TIPO_LABEL: Record<TipoInteracao, string> = {
  one_on_one: 'Reunião 1:1',
  reconhecimento: 'Reconhecimento',
  acompanhamento: 'Acompanhamento formal',
}

export const RECONHECIMENTOS = [
  'Destaque do Ciclo',
  'Liderou iniciativa',
  'Feedback positivo de cliente',
  'Colaboração exemplar',
  'Qualidade técnica excepcional',
] as const

export const MOTIVOS_ACOMPANHAMENTO = [
  'Prazos e entregas',
  'Presença e pontualidade',
  'Comunicação com a equipe',
  'Qualidade do trabalho',
  'Conduta e postura',
  'Outro',
] as const

export interface LeadershipEntry {
  id: string
  person_id: string
  author_id: string
  cycle_id: string
  tipo: TipoInteracao
  data: string
  pontos_fortes: string | null
  pontos_atencao: string | null
  plano_acao: string | null
  proxima_1a1: string | null
  reconhecimento_tipo: string | null
  motivo: string | null
  combinado: string | null
  prazo_verificacao: string | null
  gerou_advertencia: boolean
  descricao: string | null
  event_id: string | null
  created_at: string
  autor?: { nome: string } | null
  ciclo?: { nome: string } | null
}

export async function getLeadershipEntries(personId: string): Promise<LeadershipEntry[]> {
  const { data, error } = await supabase
    .from('leadership_entries')
    .select(
      '*, autor:people!leadership_entries_author_id_fkey(nome), ciclo:cycles!leadership_entries_cycle_id_fkey(nome)',
    )
    .eq('person_id', personId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as LeadershipEntry[]
}

export type NovaInteracao = {
  person_id: string
  cycle_id: string
  author_id: string
  tipo: TipoInteracao
  data: string
} & Partial<
  Pick<
    LeadershipEntry,
    | 'pontos_fortes'
    | 'pontos_atencao'
    | 'plano_acao'
    | 'proxima_1a1'
    | 'reconhecimento_tipo'
    | 'motivo'
    | 'combinado'
    | 'prazo_verificacao'
    | 'gerou_advertencia'
    | 'descricao'
    | 'event_id'
  >
>

export async function addLeadershipEntry(input: NovaInteracao): Promise<void> {
  const { error } = await supabase.from('leadership_entries').insert(input)
  if (error) throw error
}

export async function removeLeadershipEntry(id: string): Promise<void> {
  const { error } = await supabase.from('leadership_entries').delete().eq('id', id)
  if (error) throw error
}

/**
 * Eventos de agenda com o assessor por perto da data informada
 * (+/- 3 dias) — para sugerir o vínculo automático da 1:1 (PRD §6.3).
 */
export async function getEventosProximos(personId: string, data: string) {
  const base = new Date(`${data}T12:00:00`)
  const de = new Date(base.getTime() - 3 * 864e5).toISOString()
  const ate = new Date(base.getTime() + 3 * 864e5).toISOString()
  const { data: links, error: linkErr } = await supabase
    .from('event_participants')
    .select('event_id')
    .eq('person_id', personId)
  if (linkErr) throw linkErr
  const ids = (links ?? []).map((l) => l.event_id)
  if (ids.length === 0) return []
  const { data: eventos, error } = await supabase
    .from('events')
    .select('id, titulo, data')
    .in('id', ids)
    .gte('data', de)
    .lte('data', ate)
    .order('data')
  if (error) throw error
  return (eventos ?? []) as Array<{ id: string; titulo: string | null; data: string }>
}

// ---------- Aba 3: Encerramento de ciclo ----------

export type StatusParecer = 'rascunho' | 'aguardando_pc' | 'assinado'

export const STATUS_PARECER_LABEL: Record<StatusParecer, string> = {
  rascunho: 'Rascunho',
  aguardando_pc: 'Aguardando P&C',
  assinado: 'Assinado',
}
export const STATUS_PARECER_BADGE: Record<StatusParecer, 'neutral' | 'warning' | 'success'> = {
  rascunho: 'neutral',
  aguardando_pc: 'warning',
  assinado: 'success',
}

export interface CycleEndorsement {
  id: string
  person_id: string
  cycle_id: string
  sintese: string | null
  destaques: string | null
  desenvolver: string | null
  parecer_diretor: string | null
  status: StatusParecer
  assinado_em: string | null
  talento_elegivel: boolean | null
  talento_override: boolean
  talento_override_motivo: string | null
  assinante?: { nome: string } | null
}

export async function getEndorsement(
  personId: string,
  cycleId: string,
): Promise<CycleEndorsement | null> {
  const { data, error } = await supabase
    .from('cycle_endorsements')
    .select('*, assinante:people!cycle_endorsements_assinado_por_fkey(nome)')
    .eq('person_id', personId)
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  return data as unknown as CycleEndorsement | null
}

export async function upsertEndorsement(
  personId: string,
  cycleId: string,
  patch: Partial<CycleEndorsement>,
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([k]) => k !== 'assinante' && k !== 'id'),
  )
  const { error } = await supabase
    .from('cycle_endorsements')
    .upsert(
      { person_id: personId, cycle_id: cycleId, ...clean },
      { onConflict: 'person_id,cycle_id' },
    )
  if (error) throw error
}

export function parecerErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('BEV_OS_PARECER_ASSINADO'))
    return 'Este parecer já foi assinado e está travado. Só a P&C pode reabrir.'
  if (msg.includes('BEV_OS_SEM_ACESSO'))
    return 'Você não tem acesso ao perfil desta pessoa.'
  return 'Não foi possível salvar. Tente novamente.'
}

// ---------- Utilidades ----------

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** "2 ciclos · 1 ano e 2 meses" */
export function tempoDeBev(entrouEm: string, ciclos: number): string {
  const inicio = new Date(entrouEm)
  const agora = new Date()
  const meses =
    (agora.getFullYear() - inicio.getFullYear()) * 12 + (agora.getMonth() - inicio.getMonth())
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  const tempo =
    meses < 1
      ? 'menos de 1 mês'
      : anos === 0
        ? `${meses} ${meses === 1 ? 'mês' : 'meses'}`
        : `${anos} ${anos === 1 ? 'ano' : 'anos'}${resto > 0 ? ` e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : ''}`
  return `${ciclos} ${ciclos === 1 ? 'ciclo' : 'ciclos'} · ${tempo}`
}
