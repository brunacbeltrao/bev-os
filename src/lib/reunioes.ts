/**
 * Reuniões de Área (RA) — Onda 3.2. Roda em cima dos eventos RA
 * (public.events, meeting_type 'ra') com conteúdo estruturado em
 * ra_details e presença em ra_attendance (chaveada por e-mail do
 * roster, para cobrir quem ainda não ativou a conta).
 * RLS: ver = membro da subárea; gerenciar = liderança da subárea.
 */
import { supabase } from './supabase'
import { z } from 'zod'

export type RaTipo = 'brainstorming' | 'alinhamento' | 'repasse' | 'capacitacao'
export const RA_TIPO_LABELS: Record<RaTipo, string> = {
  brainstorming: 'Brainstorming',
  alinhamento: 'Alinhamento',
  repasse: 'Repasse',
  capacitacao: 'Capacitação',
}
export const RA_TIPO_ORDER: RaTipo[] = ['brainstorming', 'alinhamento', 'repasse', 'capacitacao']
export const RA_TIPO_BADGE: Record<RaTipo, 'info' | 'warning' | 'success' | 'neutral'> = {
  brainstorming: 'info',
  alinhamento: 'warning',
  repasse: 'success',
  capacitacao: 'neutral',
}

export interface RaDetails {
  event_id: string
  tipo: RaTipo | null
  insights: string | null
  observacoes: string | null
  transcricao: string | null
  repasses: string | null
  acoes: string | null
}
export interface RaMeeting {
  id: string
  data: string
  pauta: string | null
  subarea_id: string
  subarea_nome: string
  details: RaDetails | null
  presentes: number
  total: number
}
export interface AreaMember {
  email: string
  nome: string
  person_id: string | null
  foto_url: string | null
  ativo: boolean
  presente: boolean
}

function one<T>(v: T[] | T | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return (v as T) ?? null
}

export async function getRaTypeId(): Promise<string> {
  const { data, error } = await supabase.from('meeting_types').select('id').eq('slug', 'ra').single()
  if (error) throw error
  return data.id as string
}

const RaMeetingSchema = z.object({
  id: z.string(),
  data: z.string(),
  pauta: z.string().nullable(),
  subarea_id: z.string(),
  subarea: z.object({ nome: z.string() }).nullable().optional(),
  ra_details: z.union([
    z.array(z.object({
      event_id: z.string(),
      tipo: z.enum(['brainstorming', 'alinhamento', 'repasse', 'capacitacao']).nullable(),
      insights: z.string().nullable(),
      observacoes: z.string().nullable(),
      transcricao: z.string().nullable(),
      repasses: z.string().nullable(),
      acoes: z.string().nullable(),
    })),
    z.any() // Fallback single object case
  ]).nullable().optional(),
  ra_attendance: z.array(z.object({ email: z.string(), presente: z.boolean() })).optional().default([]),
})

/** Reuniões de Área do ciclo nas subáreas do escopo. */
export async function getRaMeetings(
  subareaIds: string[] | null,
  cycleId: string,
): Promise<RaMeeting[]> {
  const raType = await getRaTypeId()
  let q = supabase
    .from('events')
    .select(
      'id, data, pauta, subarea_id, subarea:subareas(nome), ra_details(*), ra_attendance(email, presente)',
    )
    .eq('cycle_id', cycleId)
    .eq('meeting_type_id', raType)
    .order('data', { ascending: false })
  if (subareaIds && subareaIds.length > 0) q = q.in('subarea_id', subareaIds)
  const { data, error } = await q
  if (error) throw error
  
  return (data ?? []).map((row) => {
    const e = RaMeetingSchema.parse(row)
    const att = e.ra_attendance
    return {
      id: e.id,
      data: e.data,
      pauta: e.pauta,
      subarea_id: e.subarea_id,
      subarea_nome: e.subarea?.nome ?? '',
      details: one<RaDetails>(e.ra_details as any),
      presentes: att.filter((a) => a.presente).length,
      total: att.length,
    }
  })
}

/** Lista de chamada da subárea: assessores/analistas do roster +
 *  presença marcada. Requer liderança (RLS do roster). */
export async function getAreaCallList(subareaId: string, eventId: string): Promise<AreaMember[]> {
  const [{ data: roster, error: rErr }, { data: people, error: pErr }, { data: att, error: aErr }] =
    await Promise.all([
      supabase
        .from('approved_roster')
        .select('email, nome')
        .eq('subarea_id', subareaId)
        .in('role', ['assessor', 'analista']),
      supabase.from('people').select('id, nome, email, foto_url'),
      supabase.from('ra_attendance').select('email, presente').eq('event_id', eventId),
    ])
  if (rErr) throw rErr
  if (pErr) throw pErr
  if (aErr) throw aErr
  const peopleByEmail = new Map((people ?? []).map((p) => [p.email.toLowerCase(), p]))
  const presentByEmail = new Map((att ?? []).map((a) => [a.email.toLowerCase(), a.presente]))
  return (roster ?? [])
    .map((r) => {
      const email = r.email.toLowerCase()
      const p = peopleByEmail.get(email)
      return {
        email,
        nome: p?.nome ?? r.nome,
        person_id: p?.id ?? null,
        foto_url: p?.foto_url ?? null,
        ativo: !!p,
        presente: presentByEmail.get(email) ?? false,
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function createRaMeeting(
  subareaId: string,
  dataIso: string,
  criadoPor: string,
): Promise<string> {
  const raType = await getRaTypeId()
  const { data: sa } = await supabase
    .from('subareas')
    .select('directorate_id')
    .eq('id', subareaId)
    .single()
  const { data, error } = await supabase
    .from('events')
    .insert({
      meeting_type_id: raType,
      subarea_id: subareaId,
      data: dataIso,
      criado_por: criadoPor,
      audiencia: 'areas',
    })
    .select('id')
    .single()
  if (error) throw error
  const id = data.id as string
  if (sa?.directorate_id) {
    await supabase
      .from('event_target_directorates')
      .insert({ event_id: id, directorate_id: sa.directorate_id })
  }
  return id
}

export async function updateMeetingBasics(
  eventId: string,
  patch: { data?: string; pauta?: string | null },
): Promise<void> {
  const { error } = await supabase.from('events').update(patch).eq('id', eventId)
  if (error) throw error
}

export async function upsertRaDetails(eventId: string, patch: Partial<RaDetails>): Promise<void> {
  const { error } = await supabase
    .from('ra_details')
    .upsert({ event_id: eventId, ...patch }, { onConflict: 'event_id' })
  if (error) throw error
}

export async function setAttendance(
  eventId: string,
  email: string,
  presente: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('ra_attendance')
    .upsert({ event_id: eventId, email: email.toLowerCase(), presente }, { onConflict: 'event_id,email' })
  if (error) throw error
}

export async function deleteMeeting(eventId: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId)
  if (error) throw error
}

/** Presença de uma pessoa nas RAs do ciclo (para Meus Liderados). */
export async function getPersonRaPresence(
  email: string,
  cycleId: string,
): Promise<{ present: number; total: number }> {
  const raType = await getRaTypeId()
  const { data: evs, error: eErr } = await supabase
    .from('events')
    .select('id')
    .eq('cycle_id', cycleId)
    .eq('meeting_type_id', raType)
  if (eErr) throw eErr
  const ids = (evs ?? []).map((e) => e.id)
  if (ids.length === 0) return { present: 0, total: 0 }
  const { data: att, error: aErr } = await supabase
    .from('ra_attendance')
    .select('event_id, presente')
    .eq('email', email.toLowerCase())
    .in('event_id', ids)
  if (aErr) throw aErr
  const rows = att ?? []
  return { present: rows.filter((r) => r.presente).length, total: rows.length }
}

/** Próxima segunda-feira às 22h (horário local), em ISO. */
export function nextMondayAt22(): string {
  const d = new Date()
  const day = d.getDay() // 0=dom ... 1=seg
  let diff = (1 - day + 7) % 7
  if (diff === 0) diff = 0 // hoje é segunda → hoje 22h
  d.setDate(d.getDate() + diff)
  d.setHours(22, 0, 0, 0)
  return d.toISOString()
}
