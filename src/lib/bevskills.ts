/**
 * BevSkills — plataforma de aprendizagem do BEV.
 * Catálogo sob demanda por diretoria, sala de aula com player embutido
 * e CMS descentralizado (cada diretoria cuida da própria vitrine).
 *
 * Vídeo nunca é hospedado aqui: o gestor cola a URL do YouTube, Drive,
 * Vimeo ou Loom e o sistema monta o iframe.
 */
import { supabase } from './supabase'

// ---------- Tipos ----------

export type CourseStatus = 'rascunho' | 'publicado' | 'em_breve'

export const STATUS_LABEL: Record<CourseStatus, string> = {
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  em_breve: 'Em breve',
}
export const STATUS_BADGE: Record<CourseStatus, 'neutral' | 'success' | 'info'> = {
  rascunho: 'neutral',
  publicado: 'success',
  em_breve: 'info',
}

export type VideoFonte = 'youtube' | 'drive' | 'vimeo' | 'loom'

export const FONTE_LABEL: Record<VideoFonte, string> = {
  youtube: 'YouTube (não listado)',
  drive: 'Google Drive / Meet',
  vimeo: 'Vimeo',
  loom: 'Loom',
}

export type ResourceTipo = 'arquivo' | 'canva' | 'miro' | 'notion' | 'drive' | 'link'

export const RECURSO_LABEL: Record<ResourceTipo, string> = {
  arquivo: 'Arquivo',
  canva: 'Canva',
  miro: 'Miro',
  notion: 'Notion',
  drive: 'Google Drive',
  link: 'Link externo',
}

/** Ordem das fileiras na Home, conforme o PRD §3. */
export const ORDEM_DIRETORIAS = [
  'negocios',
  'projetos',
  'gestao',
  'institucional',
  'pessoas_cultura',
] as const

/** Cor de acento de cada fileira — só para o marcador da seção. */
export const COR_DIRETORIA: Record<string, string> = {
  negocios: 'bg-emerald-500',
  projetos: 'bg-sky-500',
  gestao: 'bg-amber-500',
  institucional: 'bg-violet-500',
  pessoas_cultura: 'bg-orange-500',
}

export interface CatalogoItem {
  id: string
  directorate_id: string
  diretoria: string
  diretoria_slug: string
  titulo: string
  descricao: string | null
  instrutor: string | null
  status: CourseStatus
  capa_url: string | null
  ordem: number
  total_aulas: number
  aulas_concluidas: number
  ultima_aula_em: string | null
  pode_gerir: boolean
}

export interface BevResource {
  id: string
  lesson_id: string
  titulo: string
  tipo: ResourceTipo
  url: string
  ordem: number
}

export interface BevLesson {
  id: string
  module_id: string
  titulo: string
  descricao: string | null
  video_url: string | null
  video_fonte: VideoFonte | null
  duracao_min: number | null
  ordem: number
  recursos: BevResource[]
}

export interface BevModule {
  id: string
  course_id: string
  titulo: string
  ordem: number
  bloqueado: boolean
  aulas: BevLesson[]
}

export interface BevCourse {
  id: string
  directorate_id: string
  titulo: string
  descricao: string | null
  instrutor: string | null
  status: CourseStatus
  capa_url: string | null
  ordem: number
  diretoria: { nome: string; slug: string }
  modulos: BevModule[]
}

export interface Diretoria {
  id: string
  slug: string
  nome: string
}

export async function getDiretorias(): Promise<Diretoria[]> {
  const { data, error } = await supabase.from('directorates').select('id, slug, nome')
  if (error) throw error
  const lista = (data ?? []) as Diretoria[]
  return lista.sort((a, b) => {
    const ia = ORDEM_DIRETORIAS.indexOf(a.slug as never)
    const ib = ORDEM_DIRETORIAS.indexOf(b.slug as never)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
}

// ---------- Catálogo (Home) ----------

export async function getCatalogo(): Promise<CatalogoItem[]> {
  const { data, error } = await supabase.rpc('bev_catalogo')
  if (error) throw error
  return (data ?? []) as CatalogoItem[]
}

/** Agrupa o catálogo em fileiras na ordem definida pelo PRD. */
export function agruparPorDiretoria(itens: CatalogoItem[]) {
  const mapa = new Map<string, { slug: string; nome: string; cursos: CatalogoItem[] }>()
  for (const c of itens) {
    if (!mapa.has(c.diretoria_slug))
      mapa.set(c.diretoria_slug, { slug: c.diretoria_slug, nome: c.diretoria, cursos: [] })
    mapa.get(c.diretoria_slug)!.cursos.push(c)
  }
  const ordenadas = [...mapa.values()].sort((a, b) => {
    const ia = ORDEM_DIRETORIAS.indexOf(a.slug as never)
    const ib = ORDEM_DIRETORIAS.indexOf(b.slug as never)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  return ordenadas
}

// ---------- Curso completo (Sala de Aula e CMS) ----------

const CURSO_SELECT =
  '*, diretoria:directorates(nome, slug), modulos:bev_modules(*, aulas:bev_lessons(*, recursos:bev_resources(*)))'

function ordenarCurso(c: BevCourse): BevCourse {
  const modulos = [...(c.modulos ?? [])].sort((a, b) => a.ordem - b.ordem)
  for (const m of modulos) {
    m.aulas = [...(m.aulas ?? [])].sort((a, b) => a.ordem - b.ordem)
    for (const a of m.aulas) a.recursos = [...(a.recursos ?? [])].sort((x, y) => x.ordem - y.ordem)
  }
  return { ...c, modulos }
}

export async function getCurso(courseId: string): Promise<BevCourse> {
  const { data, error } = await supabase
    .from('bev_courses')
    .select(CURSO_SELECT)
    .eq('id', courseId)
    .single()
  if (error) throw error
  return ordenarCurso(data as unknown as BevCourse)
}

/** Cursos que eu administro (CMS), incluindo rascunhos. */
export async function getCursosGeridos(): Promise<CatalogoItem[]> {
  const todos = await getCatalogo()
  return todos.filter((c) => c.pode_gerir)
}

// ---------- Progresso ----------

export interface ProgressoAula {
  lesson_id: string
  concluida_em: string | null
  visto_em: string
}

export async function getProgressoCurso(
  personId: string,
  lessonIds: string[],
): Promise<ProgressoAula[]> {
  if (lessonIds.length === 0) return []
  const { data, error } = await supabase
    .from('bev_progress')
    .select('lesson_id, concluida_em, visto_em')
    .eq('person_id', personId)
    .in('lesson_id', lessonIds)
  if (error) throw error
  return (data ?? []) as ProgressoAula[]
}

/** Marca a aula como vista agora (chamado ao abrir a aula). */
export async function registrarVisita(personId: string, lessonId: string): Promise<void> {
  const { error } = await supabase
    .from('bev_progress')
    .upsert(
      { person_id: personId, lesson_id: lessonId, visto_em: new Date().toISOString() },
      { onConflict: 'person_id,lesson_id', ignoreDuplicates: false },
    )
  if (error) throw error
}

export async function setAulaConcluida(
  personId: string,
  lessonId: string,
  concluida: boolean,
): Promise<void> {
  const { error } = await supabase.from('bev_progress').upsert(
    {
      person_id: personId,
      lesson_id: lessonId,
      concluida_em: concluida ? new Date().toISOString() : null,
      visto_em: new Date().toISOString(),
    },
    { onConflict: 'person_id,lesson_id' },
  )
  if (error) throw error
}

/** A aula onde parei neste curso — ou a primeira, se ainda não comecei. */
export function proximaAula(curso: BevCourse, progresso: ProgressoAula[]): BevLesson | null {
  const aulas = curso.modulos.flatMap((m) => (m.bloqueado ? [] : m.aulas))
  if (aulas.length === 0) return null
  const mapa = new Map(progresso.map((p) => [p.lesson_id, p]))
  const naoConcluida = aulas.find((a) => !mapa.get(a.id)?.concluida_em)
  if (naoConcluida) return naoConcluida
  return aulas[aulas.length - 1]
}

// ---------- Embed de vídeo ----------

/** Converte a URL colada pelo gestor no endereço de embed da fonte. */
export function urlDeEmbed(url: string | null, fonte: VideoFonte | null): string | null {
  if (!url) return null
  const u = url.trim()
  try {
    if (fonte === 'youtube') {
      const id =
        u.match(/[?&]v=([\w-]{6,})/)?.[1] ??
        u.match(/youtu\.be\/([\w-]{6,})/)?.[1] ??
        u.match(/\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1]
      return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : null
    }
    if (fonte === 'vimeo') {
      const id = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1]
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
    if (fonte === 'loom') {
      const id = u.match(/loom\.com\/(?:share|embed)\/([\w-]+)/)?.[1]
      return id ? `https://www.loom.com/embed/${id}` : null
    }
    if (fonte === 'drive') {
      const id = u.match(/\/d\/([\w-]+)/)?.[1] ?? u.match(/[?&]id=([\w-]+)/)?.[1]
      return id ? `https://drive.google.com/file/d/${id}/preview` : null
    }
  } catch {
    return null
  }
  return null
}

/** Detecta a fonte a partir da URL, para o gestor não precisar escolher. */
export function detectarFonte(url: string): VideoFonte | null {
  const u = url.toLowerCase()
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('vimeo.com')) return 'vimeo'
  if (u.includes('loom.com')) return 'loom'
  if (u.includes('drive.google.com') || u.includes('docs.google.com')) return 'drive'
  return null
}

// ---------- CMS ----------

export async function criarCurso(input: {
  directorate_id: string
  titulo: string
  descricao?: string | null
  instrutor?: string | null
  status: CourseStatus
  capa_url?: string | null
  criado_por: string
}): Promise<string> {
  const { data, error } = await supabase
    .from('bev_courses')
    .insert({ ...input, ordem: 99 })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function atualizarCurso(
  courseId: string,
  patch: Partial<Omit<BevCourse, 'id' | 'diretoria' | 'modulos'>>,
): Promise<void> {
  const { error } = await supabase.from('bev_courses').update(patch).eq('id', courseId)
  if (error) throw error
}

export async function removerCurso(courseId: string): Promise<void> {
  const { error } = await supabase.from('bev_courses').delete().eq('id', courseId)
  if (error) throw error
}

export async function criarModulo(courseId: string, titulo: string, ordem: number) {
  const { error } = await supabase.from('bev_modules').insert({ course_id: courseId, titulo, ordem })
  if (error) throw error
}
export async function atualizarModulo(id: string, patch: Partial<BevModule>) {
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => k !== 'aulas'))
  const { error } = await supabase.from('bev_modules').update(clean).eq('id', id)
  if (error) throw error
}
export async function removerModulo(id: string) {
  const { error } = await supabase.from('bev_modules').delete().eq('id', id)
  if (error) throw error
}

export async function criarAula(moduleId: string, titulo: string, ordem: number) {
  const { error } = await supabase.from('bev_lessons').insert({ module_id: moduleId, titulo, ordem })
  if (error) throw error
}
export async function atualizarAula(id: string, patch: Partial<BevLesson>) {
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => k !== 'recursos'))
  const { error } = await supabase.from('bev_lessons').update(clean).eq('id', id)
  if (error) throw error
}
export async function removerAula(id: string) {
  const { error } = await supabase.from('bev_lessons').delete().eq('id', id)
  if (error) throw error
}

export async function criarRecurso(input: Omit<BevResource, 'id'>) {
  const { error } = await supabase.from('bev_resources').insert(input)
  if (error) throw error
}
export async function removerRecurso(id: string) {
  const { error } = await supabase.from('bev_resources').delete().eq('id', id)
  if (error) throw error
}

/** Reordena uma lista inteira em uma chamada por item. */
export async function reordenar(
  tabela: 'bev_modules' | 'bev_lessons',
  ids: string[],
): Promise<void> {
  await Promise.all(
    ids.map((id, i) => supabase.from(tabela).update({ ordem: i + 1 }).eq('id', id)),
  )
}

// ---------- Upload ----------

const MAX_MB = 2

export async function subirCapa(courseKey: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('BEVSKILLS_TIPO')
  if (file.size > MAX_MB * 1024 * 1024) throw new Error('BEVSKILLS_TAMANHO')
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const caminho = `capas/${courseKey}-${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('bevskills')
    .upload(caminho, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return supabase.storage.from('bevskills').getPublicUrl(caminho).data.publicUrl
}

export async function subirMaterial(lessonId: string, file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error('BEVSKILLS_TAMANHO')
  const caminho = `materiais/${lessonId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`
  const { error } = await supabase.storage
    .from('bevskills')
    .upload(caminho, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from('bevskills').getPublicUrl(caminho).data.publicUrl
}

export function uploadErro(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err)
  if (m.includes('BEVSKILLS_TIPO')) return 'Use uma imagem JPG, PNG ou WEBP.'
  if (m.includes('BEVSKILLS_TAMANHO')) return `O arquivo passou do limite (${MAX_MB} MB na capa).`
  return 'Não foi possível enviar o arquivo. Tente novamente.'
}
