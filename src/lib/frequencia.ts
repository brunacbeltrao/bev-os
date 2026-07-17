/** Frequência (Onda 3 / ADD §3.9) — justificativa de ausência em RG/RD/RL/RA. */
import { supabase } from './supabase'
import type { AgendaEvent } from './agenda'

export type JustStatus = 'pendente' | 'aprovado' | 'rejeitado'
export const JUST_BADGE: Record<JustStatus, 'warning' | 'success' | 'danger'> = {
  pendente: 'warning',
  aprovado: 'success',
  rejeitado: 'danger',
}
export interface Justification {
  id: string
  person_id: string
  event_id: string
  motivo: string
  status: JustStatus
  created_at: string
  event: Pick<AgendaEvent, 'id' | 'data' | 'titulo'> & {
    meeting_type: { slug: string; nome: string }
  }
  pessoa?: { nome: string }
}

export async function getJustifications() {
  const { data, error } = await supabase
    .from('absence_justifications')
    .select(
      '*, event:events(id, data, titulo, meeting_type:meeting_types(slug, nome)), pessoa:people!absence_justifications_person_id_fkey(nome)',
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Justification[]
}
export async function createJustification(personId: string, eventId: string, motivo: string) {
  const { error } = await supabase
    .from('absence_justifications')
    .insert({ person_id: personId, event_id: eventId, motivo })
  if (error) throw error
}
export async function setJustificationStatus(id: string, status: JustStatus) {
  const { error } = await supabase.from('absence_justifications').update({ status }).eq('id', id)
  if (error) throw error
}
