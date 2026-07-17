/**
 * Bev News (Onda 1 / ADD §3.3b) — feed de cultura e integração.
 * Qualquer membro publica e reage; sem hierarquia de aprovação.
 */
import { supabase } from './supabase'
import type { Person } from './org'

export type NewsTipo = 'premiacao' | 'vivencia' | 'aniversario' | 'outro'

export const NEWS_TIPO_LABELS: Record<NewsTipo, string> = {
  premiacao: 'Premiação',
  vivencia: 'Vivência',
  aniversario: 'Aniversário',
  outro: 'Outro',
}

export interface NewsPost {
  id: string
  autor_id: string
  tipo: NewsTipo
  texto: string
  imagem_url: string | null
  cycle_id: string
  created_at: string
  autor: Pick<Person, 'id' | 'nome' | 'foto_url'>
  reactions: Array<{ person_id: string }>
  comments: NewsComment[]
}

export interface NewsComment {
  id: string
  news_post_id: string
  person_id: string
  texto: string
  created_at: string
  autor: Pick<Person, 'id' | 'nome' | 'foto_url'>
}

export async function getNewsFeed(): Promise<NewsPost[]> {
  const { data, error } = await supabase
    .from('news_posts')
    .select('*, autor:people!news_posts_autor_id_fkey(id, nome, foto_url), reactions:news_reactions(person_id), comments:news_comments(*, autor:people!news_comments_person_id_fkey(id, nome, foto_url))')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as unknown as NewsPost[]
}

export async function createNewsPost(
  autorId: string,
  tipo: NewsTipo,
  texto: string,
  imagemUrl?: string,
): Promise<void> {
  const { error } = await supabase
    .from('news_posts')
    .insert({ autor_id: autorId, tipo, texto, imagem_url: imagemUrl || null })
  if (error) throw error
}

export async function deleteNewsPost(postId: string): Promise<void> {
  const { error } = await supabase.from('news_posts').delete().eq('id', postId)
  if (error) throw error
}

export async function toggleReaction(
  postId: string,
  personId: string,
  hasReacted: boolean,
): Promise<void> {
  if (hasReacted) {
    const { error } = await supabase
      .from('news_reactions')
      .delete()
      .eq('news_post_id', postId)
      .eq('person_id', personId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('news_reactions')
      .insert({ news_post_id: postId, person_id: personId })
    if (error) throw error
  }
}

export async function addNewsComment(postId: string, personId: string, texto: string): Promise<void> {
  const { error } = await supabase.from('news_comments').insert({
    news_post_id: postId,
    person_id: personId,
    texto,
  })
  if (error) throw error
}
