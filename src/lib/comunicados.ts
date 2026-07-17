/**
 * Avisos (ex-Comunicados) — mural institucional que substitui o
 * "Bev Avisos" do Telegram. Apenas a DIRETORIA publica (correção
 * da Bruna, 10/07/2026); todos leem; histórico buscável; suporta
 * link, imagens e arquivos (bucket "avisos" no Storage).
 */
import { supabase } from './supabase'
import type { Person } from './org'

export interface AnnouncementAttachment {
  id: string
  nome: string
  url: string
  tipo: 'imagem' | 'arquivo'
}

export interface Announcement {
  id: string
  titulo: string
  texto: string
  link_url: string | null
  autor_id: string
  cycle_id: string
  created_at: string
  autor: Pick<Person, 'id' | 'nome' | 'foto_url'>
  reads: Array<{ person_id: string }>
  attachments: AnnouncementAttachment[]
}


export async function getAnnouncements(cycleId: string, search?: string): Promise<Announcement[]> {
  let query = supabase
    .from('announcements')
    .select(
      '*, autor:people!announcements_autor_id_fkey(id, nome, foto_url), reads:announcement_reads(person_id), attachments:announcement_attachments(id, nome, url, tipo)',
    )
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
  const term = search?.trim()
  if (term) query = query.or(`titulo.ilike.%${term}%,texto.ilike.%${term}%`)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Announcement[]
}

export async function createAnnouncement(input: {
  titulo: string
  texto: string
  autorId: string
  linkUrl?: string
  files?: File[]
}): Promise<void> {
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      titulo: input.titulo,
      texto: input.texto,
      autor_id: input.autorId,
      link_url: input.linkUrl?.trim() || null,
    })
    .select('id')
    .single()
  if (error) throw error

  for (const file of input.files ?? []) {
    const path = `${data.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from('avisos').upload(path, file)
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from('avisos').getPublicUrl(path)
    const { error: attErr } = await supabase.from('announcement_attachments').insert({
      announcement_id: data.id,
      nome: file.name,
      url: pub.publicUrl,
      tipo: file.type.startsWith('image/') ? 'imagem' : 'arquivo',
    })
    if (attErr) throw attErr
  }
}

export async function updateAnnouncement(
  id: string,
  patch: { titulo: string; texto: string; linkUrl?: string },
): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .update({ titulo: patch.titulo, texto: patch.texto, link_url: patch.linkUrl?.trim() || null })
    .eq('id', id)
  if (error) throw error
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
}

/** Marca como lido (idempotente — PK composta ignora duplicata). */
export async function markAsRead(announcementId: string, personId: string): Promise<void> {
  const { error } = await supabase
    .from('announcement_reads')
    .upsert(
      { announcement_id: announcementId, person_id: personId },
      { onConflict: 'announcement_id,person_id', ignoreDuplicates: true },
    )
  if (error) throw error
}


