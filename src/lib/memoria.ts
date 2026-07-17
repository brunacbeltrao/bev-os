/** Memória Institucional (Onda 4 / ADD §3.12) — POPs, atas, templates,
 *  contratos com busca. Só P&C + Direx publicam; todos leem (RLS). */
import { supabase } from './supabase'

export type MemoryTipo = 'pop' | 'ata' | 'template' | 'contrato'
export const MEMORY_TIPO_LABELS: Record<MemoryTipo, string> = {
  pop: 'POP',
  ata: 'Ata',
  template: 'Template',
  contrato: 'Contrato',
}
export const MEMORY_TIPO_ORDER: MemoryTipo[] = ['pop', 'ata', 'template', 'contrato']
export const MEMORY_TIPO_BADGE: Record<MemoryTipo, 'info' | 'warning' | 'success' | 'neutral'> = {
  pop: 'info',
  ata: 'warning',
  template: 'success',
  contrato: 'neutral',
}

export interface MemoryDoc {
  id: string
  titulo: string
  conteudo: string
  tipo: MemoryTipo
  subarea_id: string | null
  autor_id: string
  updated_at: string
  autor?: { nome: string } | null
  subarea?: { nome: string } | null
}

export async function getMemoryDocs(search: string, tipo: MemoryTipo | 'todos'): Promise<MemoryDoc[]> {
  let q = supabase
    .from('memory_docs')
    .select(
      'id, titulo, conteudo, tipo, subarea_id, autor_id, updated_at, autor:people!memory_docs_autor_id_fkey(nome), subarea:subareas(nome)',
    )
    .order('updated_at', { ascending: false })
  if (tipo !== 'todos') q = q.eq('tipo', tipo)
  const term = search.trim()
  if (term.length >= 2) q = q.or(`titulo.ilike.%${term}%,conteudo.ilike.%${term}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as MemoryDoc[]
}

export interface NewMemoryDoc {
  titulo: string
  conteudo: string
  tipo: MemoryTipo
  subarea_id: string | null
  autor_id: string
}
export async function createMemoryDoc(input: NewMemoryDoc): Promise<string> {
  const { data, error } = await supabase
    .from('memory_docs')
    .insert({
      titulo: input.titulo,
      conteudo: input.conteudo,
      tipo: input.tipo,
      subarea_id: input.subarea_id,
      autor_id: input.autor_id,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
export async function updateMemoryDoc(
  id: string,
  patch: Partial<Pick<MemoryDoc, 'titulo' | 'conteudo' | 'tipo' | 'subarea_id'>>,
): Promise<void> {
  const { error } = await supabase.from('memory_docs').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteMemoryDoc(id: string): Promise<void> {
  const { error } = await supabase.from('memory_docs').delete().eq('id', id)
  if (error) throw error
}
