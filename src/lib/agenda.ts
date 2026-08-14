/**
 * Agenda / Reuniões (Onda 1 / ADD §3.2) — os tipos oficiais do
 * Regimento: RG (mensal, todos), RD (semanal, diretores),
 * RL (semanal, lideranças).
 * Quem vê o quê é resolvido pelo RLS lendo occupations.
 */
import { supabase } from './supabase'
import { z } from 'zod'

export type MeetingSlug =
  | 'rg'
  | 'rd'
  | 'rl'
  | 'capacitacao'
  | 'evento_mej'
  | 'coworking'
  | 'outro'

/** Categorias além das reuniões do Regimento (pedido da Bruna). */
export const CATEGORIAS_EXTRAS: MeetingSlug[] = ['capacitacao', 'evento_mej', 'coworking', 'outro']

export interface MeetingType {
  id: string
  slug: MeetingSlug
  nome: string
}

export const MEETING_LABELS: Record<MeetingSlug, string> = {
  rg: 'RG · Reunião Geral',
  rd: 'RD · Reunião de Diretoria',
  rl: 'RL · Reunião de Lideranças',
  capacitacao: 'Capacitação',
  evento_mej: 'Evento MEJ',
  coworking: 'Coworking',
  outro: 'Outro',
}

/** Rótulo curto para o chip do calendário. */
export const MEETING_CHIP: Record<MeetingSlug, string> = {
  rg: 'RG',
  rd: 'RD',
  rl: 'RL',
  capacitacao: 'Capacitação',
  evento_mej: 'MEJ',
  coworking: 'Coworking',
  outro: 'Evento',
}

/** Cor de badge por tipo — via tokens da paleta transversal. */
export const MEETING_BADGE: Record<MeetingSlug, 'info' | 'danger' | 'warning' | 'success' | 'neutral'> = {
  rg: 'info',
  rd: 'danger',
  rl: 'warning',
  capacitacao: 'info',
  evento_mej: 'warning',
  coworking: 'success',
  outro: 'neutral',
}

export type EventAudience = 'bev' | 'diretores' | 'diretores_gerentes' | 'areas'
export const AUDIENCE_LABELS: Record<EventAudience, string> = {
  bev: 'Todo o BEV',
  diretores: 'Diretores',
  diretores_gerentes: 'Diretores e Gerentes',
  areas: 'Área(s)',
}
export type RsvpStatus = 'confirmado' | 'recusado'
export type PapelObrig = 'diretor' | 'gerente' | 'assessor'

export interface AgendaEvent {
  id: string
  meeting_type_id: string
  subarea_id: string | null
  data: string
  titulo: string | null
  pauta: string | null
  criado_por: string
  cycle_id: string
  audiencia: EventAudience
  link_reuniao: string | null
  obrig_diretores: boolean
  obrig_gerentes: boolean
  obrig_assessores: boolean
  meeting_type: MeetingType
  subarea: { id: string; nome: string } | null
  target_directorate_ids: string[]
  rsvps: Array<{ person_id: string; status: RsvpStatus }>
}

/** Um evento é obrigatório para um papel (diretor/gerente/assessor)? */
export function isObrigatorio(e: AgendaEvent, role: string): boolean {
  if (role === 'diretor') return e.obrig_diretores
  if (role === 'gerente' || role === 'coordenador') return e.obrig_gerentes
  return e.obrig_assessores // analista/assessor
}
export function audienceLabel(e: AgendaEvent, dirNome?: (id: string) => string): string {
  if (e.audiencia !== 'areas') return AUDIENCE_LABELS[e.audiencia]
  if (dirNome && e.target_directorate_ids.length)
    return e.target_directorate_ids.map(dirNome).join(', ')
  return e.subarea?.nome ?? 'Área(s)'
}

/** Nome exibível do evento: título livre ou o rótulo da categoria. */
export function eventDisplayName(e: AgendaEvent): string {
  return e.titulo?.trim() || MEETING_LABELS[e.meeting_type.slug]
}

export interface MeetingMinute {
  id: string
  event_id: string
  conteudo: string
  criado_por: string
  updated_at: string
}

export interface MinuteDecision {
  id: string
  minute_id: string
  descricao: string
  demand_id: string | null
  created_at: string
}

export async function getMeetingTypes(): Promise<MeetingType[]> {
  const { data, error } = await supabase.from('meeting_types').select('*')
  if (error) throw error
  return (data ?? []) as MeetingType[]
}

const EVENT_SELECT =
  '*, meeting_type:meeting_types(id, slug, nome), subarea:subareas(id, nome), targets:event_target_directorates(directorate_id), rsvps:event_rsvp(person_id, status)'

const AgendaEventSchema = z.object({
  id: z.string(),
  meeting_type_id: z.string(),
  subarea_id: z.string().nullable(),
  data: z.string(),
  titulo: z.string().nullable(),
  pauta: z.string().nullable(),
  criado_por: z.string(),
  cycle_id: z.string(),
  audiencia: z.enum(['bev', 'diretores', 'diretores_gerentes', 'areas']),
  link_reuniao: z.string().nullable(),
  obrig_diretores: z.boolean(),
  obrig_gerentes: z.boolean(),
  obrig_assessores: z.boolean(),
  meeting_type: z.object({
    id: z.string(),
    slug: z.string(),
    nome: z.string()
  }),
  subarea: z.object({
    id: z.string(),
    nome: z.string()
  }).nullable(),
  targets: z.array(z.object({ directorate_id: z.string() })).optional().default([]),
  rsvps: z.array(z.object({ person_id: z.string(), status: z.enum(['confirmado', 'recusado']) })).optional().default([])
})

function mapEvent(row: unknown): AgendaEvent {
  const parsed = AgendaEventSchema.parse(row)
  return {
    ...parsed,
    target_directorate_ids: parsed.targets.map((t) => t.directorate_id),
    rsvps: parsed.rsvps,
  } as AgendaEvent
}

/** Eventos visíveis (RLS filtra por audiência) num intervalo. */
export async function getEvents(fromIso: string, toIso: string): Promise<AgendaEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .gte('data', fromIso)
    .lt('data', toIso)
    .order('data', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => mapEvent(r))
}

/** Compromissos futuros obrigatórios para o meu papel e ainda sem RSVP meu. */
export async function getMyPendingConfirmations(
  personId: string,
  role: string,
): Promise<AgendaEvent[]> {
  const eventos = await getUpcomingEvents(40)
  return eventos.filter(
    (e) => isObrigatorio(e, role) && !e.rsvps.some((r) => r.person_id === personId),
  )
}

export async function getUpcomingEvents(limit = 8): Promise<AgendaEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT)
    .gte('data', new Date().toISOString())
    .order('data', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => mapEvent(r))
}

export interface NewEvent {
  meeting_type_id: string
  subarea_id: string | null
  data: string
  titulo?: string
  pauta?: string
  criado_por: string
  audiencia: EventAudience
  link_reuniao?: string
  obrig_diretores: boolean
  obrig_gerentes: boolean
  obrig_assessores: boolean
  targetDirectorateIds: string[]
}

export async function createEvent(input: NewEvent): Promise<string> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      meeting_type_id: input.meeting_type_id,
      subarea_id: input.subarea_id,
      data: input.data,
      titulo: input.titulo?.trim() || null,
      pauta: input.pauta || null,
      criado_por: input.criado_por,
      audiencia: input.audiencia,
      link_reuniao: input.link_reuniao?.trim() || null,
      obrig_diretores: input.obrig_diretores,
      obrig_gerentes: input.obrig_gerentes,
      obrig_assessores: input.obrig_assessores,
    })
    .select('id')
    .single()
  if (error) throw error
  const id = data.id as string
  if (input.audiencia === 'areas' && input.targetDirectorateIds.length > 0) {
    const { error: tErr } = await supabase
      .from('event_target_directorates')
      .insert(input.targetDirectorateIds.map((directorate_id) => ({ event_id: id, directorate_id })))
    if (tErr) throw tErr
  }
  return id
}

export interface EventPatch {
  meeting_type_id?: string
  data?: string
  titulo?: string | null
  audiencia?: EventAudience
  link_reuniao?: string | null
  obrig_diretores?: boolean
  obrig_gerentes?: boolean
  obrig_assessores?: boolean
}

/**
 * Edita um evento existente. Usa update simples (sem `.select()`), então
 * não depende da policy de SELECT no retorno. Quando `targetDirectorateIds`
 * é informado, sincroniza as áreas-alvo (apaga as atuais e regrava).
 */
export async function updateEvent(
  eventId: string,
  patch: EventPatch,
  targetDirectorateIds?: string[],
): Promise<void> {
  const { error } = await supabase.from('events').update(patch).eq('id', eventId)
  if (error) throw error
  if (targetDirectorateIds !== undefined) {
    const { error: delErr } = await supabase
      .from('event_target_directorates')
      .delete()
      .eq('event_id', eventId)
    if (delErr) throw delErr
    if (patch.audiencia === 'areas' && targetDirectorateIds.length > 0) {
      const { error: insErr } = await supabase
        .from('event_target_directorates')
        .insert(targetDirectorateIds.map((directorate_id) => ({ event_id: eventId, directorate_id })))
      if (insErr) throw insErr
    }
  }
}

export async function updateEventLink(eventId: string, link: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .update({ link_reuniao: link.trim() || null })
    .eq('id', eventId)
  if (error) throw error
}

// ---------- RSVP ----------
export async function setRsvp(eventId: string, personId: string, status: RsvpStatus): Promise<void> {
  const { error } = await supabase
    .from('event_rsvp')
    .upsert({ event_id: eventId, person_id: personId, status }, { onConflict: 'event_id,person_id' })
  if (error) throw error
}

export interface RsvpRow {
  person_id: string
  status: RsvpStatus
  pessoa: { nome: string; foto_url: string | null }
}
export async function getEventRsvps(eventId: string): Promise<RsvpRow[]> {
  const { data, error } = await supabase
    .from('event_rsvp')
    .select('person_id, status, pessoa:people!event_rsvp_person_id_fkey(nome, foto_url)')
    .eq('event_id', eventId)
  if (error) throw error
  return (data ?? []) as unknown as RsvpRow[]
}

// ---------- Documentos ----------
export interface EventDoc {
  id: string
  event_id: string
  nome: string
  url: string
}
export async function getEventDocs(eventId: string): Promise<EventDoc[]> {
  const { data, error } = await supabase
    .from('event_docs')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as EventDoc[]
}
export async function addEventDoc(eventId: string, nome: string, url: string): Promise<void> {
  const { error } = await supabase.from('event_docs').insert({ event_id: eventId, nome, url })
  if (error) throw error
}
export async function deleteEventDoc(id: string): Promise<void> {
  const { error } = await supabase.from('event_docs').delete().eq('id', id)
  if (error) throw error
}

export async function updateEventPauta(eventId: string, pauta: string): Promise<void> {
  const { error } = await supabase.from('events').update({ pauta: pauta || null }).eq('id', eventId)
  if (error) throw error
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error
}

export async function getMinute(eventId: string): Promise<MeetingMinute | null> {
  const { data, error } = await supabase
    .from('meeting_minutes')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()
  if (error) throw error
  return data as MeetingMinute | null
}

export async function upsertMinute(
  eventId: string,
  conteudo: string,
  criadoPor: string,
): Promise<MeetingMinute> {
  const existing = await getMinute(eventId)
  if (existing) {
    const { data, error } = await supabase
      .from('meeting_minutes')
      .update({ conteudo })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) throw error
    return data as MeetingMinute
  }
  const { data, error } = await supabase
    .from('meeting_minutes')
    .insert({ event_id: eventId, conteudo, criado_por: criadoPor })
    .select('*')
    .single()
  if (error) throw error
  return data as MeetingMinute
}

export async function getDecisions(minuteId: string): Promise<MinuteDecision[]> {
  const { data, error } = await supabase
    .from('minute_decisions')
    .select('*')
    .eq('minute_id', minuteId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as MinuteDecision[]
}

export async function addDecision(minuteId: string, descricao: string): Promise<MinuteDecision> {
  const { data, error } = await supabase
    .from('minute_decisions')
    .insert({ minute_id: minuteId, descricao })
    .select('*')
    .single()
  if (error) throw error
  return data as MinuteDecision
}

/** Fluxo Reunião → Ata → Ação: decisão gera Demanda e é vinculada. */
export async function linkDecisionToDemand(decisionId: string, demandId: string): Promise<void> {
  const { error } = await supabase
    .from('minute_decisions')
    .update({ demand_id: demandId })
    .eq('id', decisionId)
  if (error) throw error
}
