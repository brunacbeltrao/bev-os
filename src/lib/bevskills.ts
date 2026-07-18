/**
 * BevSkills — plataforma de aprendizagem do BEV OS.
 * Camada de dados: tipos + consultas/mutations no Supabase.
 *
 * O progresso do curso e a emissão de certificados são calculados por
 * TRIGGERS no banco (update_course_progress / issue_course_certificate).
 * O front apenas grava `completed` em user_lesson_progress; o resto
 * (user_course_progress e certificates) é preenchido automaticamente.
 */
import { supabase } from './supabase'

// ---------- Tipos ----------

export type LessonType = 'video' | 'text' | 'pdf' | 'attachment'

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  video: 'Vídeo',
  text: 'Texto',
  pdf: 'PDF',
  attachment: 'Material',
}

export type CourseLevel = 'Iniciante' | 'Intermediário' | 'Avançado'
export const COURSE_LEVELS: CourseLevel[] = ['Iniciante', 'Intermediário', 'Avançado']
export const LEVEL_BADGE: Record<string, 'neutral' | 'info' | 'warning'> = {
  Iniciante: 'neutral',
  Intermediário: 'info',
  Avançado: 'warning',
}

export interface LearningPath {
  id: string
  title: string
  slug: string
  description: string | null
  cover_image: string | null
  is_required: boolean
  estimated_hours: number
  order_index: number
}

export interface Course {
  id: string
  learning_path_id: string | null
  title: string
  slug: string
  description: string | null
  cover_image: string | null
  level: string | null
  estimated_minutes: number
  is_published: boolean
  order_index: number
}

export interface Module {
  id: string
  course_id: string
  title: string
  description: string | null
  order_index: number
}

export interface Lesson {
  id: string
  module_id: string
  title: string
  description: string | null
  lesson_type: LessonType
  video_url: string | null
  content: string | null
  duration_minutes: number
  order_index: number
  is_preview: boolean
}

export interface LessonAttachment {
  id: string
  lesson_id: string
  file_name: string
  file_url: string
  file_type: string | null
}

export interface UserLessonProgress {
  id: string
  user_id: string
  lesson_id: string
  completed: boolean
  completed_at: string | null
  progress_percentage: number
  last_position_seconds: number
}

export interface UserCourseProgress {
  id: string
  user_id: string
  course_id: string
  progress_percentage: number
  completed: boolean
  completed_at: string | null
}

export interface Certificate {
  id: string
  user_id: string
  course_id: string
  certificate_code: string
  issued_at: string
  file_url: string | null
  course?: Pick<Course, 'title' | 'slug'>
}

export interface CourseCategory {
  id: string
  name: string
  slug: string
}

/** Módulo com suas aulas aninhadas (currículo do curso). */
export interface ModuleWithLessons extends Module {
  lessons: Lesson[]
}

/** Aula com anexos + o curso/módulo a que pertence (para o player). */
export interface LessonDetail extends Lesson {
  lesson_attachments: LessonAttachment[]
  module: {
    id: string
    title: string
    course: Pick<Course, 'id' | 'title' | 'slug'>
  }
}

// ---------- Utilidades ----------

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

/** Formata minutos em "1h 30min" / "45min". */
export function fmtDuration(minutes: number): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}min`
  if (h) return `${h}h`
  return `${m}min`
}

// ============================================================
// LEITURA — Trilhas, cursos, currículo (fluxo do aluno)
// ============================================================

export async function getLearningPaths(): Promise<LearningPath[]> {
  const { data, error } = await supabase
    .from('learning_paths')
    .select('*')
    .order('order_index')
  if (error) throw error
  return (data ?? []) as LearningPath[]
}

export async function getLearningPathBySlug(slug: string): Promise<LearningPath | null> {
  const { data, error } = await supabase
    .from('learning_paths')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data as LearningPath | null
}

/** Cursos publicados (RLS filtra não publicados para membros). */
export async function getCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('order_index')
  if (error) throw error
  return (data ?? []) as Course[]
}

export async function getCoursesByPath(pathId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('learning_path_id', pathId)
    .eq('is_published', true)
    .order('order_index')
  if (error) throw error
  return (data ?? []) as Course[]
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data as Course | null
}

/** Módulos do curso com aulas aninhadas, tudo ordenado por order_index. */
export async function getCourseCurriculum(courseId: string): Promise<ModuleWithLessons[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('*, lessons(*)')
    .eq('course_id', courseId)
    .order('order_index')
    .order('order_index', { referencedTable: 'lessons' })
  if (error) throw error
  return (data ?? []) as ModuleWithLessons[]
}

export async function getCategories(): Promise<CourseCategory[]> {
  const { data, error } = await supabase.from('course_categories').select('*').order('name')
  if (error) throw error
  return (data ?? []) as CourseCategory[]
}

/** Categorias de um curso (via tabela de relação). */
export async function getCourseCategories(courseId: string): Promise<CourseCategory[]> {
  const { data, error } = await supabase
    .from('course_category_relations')
    .select('category:course_categories(id, name, slug)')
    .eq('course_id', courseId)
  if (error) throw error
  return ((data ?? []) as unknown as Array<{ category: CourseCategory }>).map((r) => r.category)
}

/** Detalhe de uma aula: anexos + módulo + curso (para o player). */
export async function getLesson(lessonId: string): Promise<LessonDetail | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select(
      '*, lesson_attachments(*), module:modules(id, title, course:courses(id, title, slug))',
    )
    .eq('id', lessonId)
    .maybeSingle()
  if (error) throw error
  return data as unknown as LessonDetail | null
}

// ============================================================
// PROGRESSO DO USUÁRIO
// ============================================================

/** Progresso por aula do usuário logado (RLS já restringe ao próprio). */
export async function getMyLessonProgress(): Promise<UserLessonProgress[]> {
  const { data, error } = await supabase.from('user_lesson_progress').select('*')
  if (error) throw error
  return (data ?? []) as UserLessonProgress[]
}

/** Progresso consolidado por curso do usuário logado. */
export async function getMyCourseProgress(): Promise<UserCourseProgress[]> {
  const { data, error } = await supabase.from('user_course_progress').select('*')
  if (error) throw error
  return (data ?? []) as UserCourseProgress[]
}

/**
 * Marca (ou desmarca) uma aula como concluída. Fazemos UPSERT porque
 * pode não existir linha ainda. O trigger no banco recalcula o
 * progresso do curso e emite certificado quando chega a 100%.
 */
export async function setLessonCompleted(
  userId: string,
  lessonId: string,
  completed: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('user_lesson_progress')
    .upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        progress_percentage: completed ? 100 : 0,
      },
      { onConflict: 'user_id,lesson_id' },
    )
  if (error) throw error
}

// ============================================================
// CERTIFICADOS
// ============================================================

export async function getMyCertificates(): Promise<Certificate[]> {
  const { data, error } = await supabase
    .from('certificates')
    .select('*, course:courses(title, slug)')
    .order('issued_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Certificate[]
}

// ============================================================
// ADMIN — CRUD (RLS exige is_bevskills_admin)
// ============================================================

/** Todas as trilhas (admin usa a mesma leitura pública). */
export async function adminGetPaths(): Promise<LearningPath[]> {
  return getLearningPaths()
}

/** Todos os cursos, inclusive não publicados (RLS libera para admin). */
export async function adminGetCourses(): Promise<Course[]> {
  const { data, error } = await supabase.from('courses').select('*').order('order_index')
  if (error) throw error
  return (data ?? []) as Course[]
}

// ---- Trilhas ----
export async function createPath(patch: Partial<LearningPath> & { title: string; slug: string }) {
  const { error } = await supabase.from('learning_paths').insert(patch)
  if (error) throw error
}
export async function updatePath(id: string, patch: Partial<LearningPath>) {
  const { error } = await supabase.from('learning_paths').update(patch).eq('id', id)
  if (error) throw error
}
export async function deletePath(id: string) {
  const { error } = await supabase.from('learning_paths').delete().eq('id', id)
  if (error) throw error
}

// ---- Cursos ----
export async function createCourse(patch: Partial<Course> & { title: string; slug: string }) {
  const { error } = await supabase.from('courses').insert(patch)
  if (error) throw error
}
export async function updateCourse(id: string, patch: Partial<Course>) {
  const { error } = await supabase.from('courses').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteCourse(id: string) {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}

// ---- Módulos ----
export async function createModule(patch: Partial<Module> & { course_id: string; title: string }) {
  const { error } = await supabase.from('modules').insert(patch)
  if (error) throw error
}
export async function updateModule(id: string, patch: Partial<Module>) {
  const { error } = await supabase.from('modules').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteModule(id: string) {
  const { error } = await supabase.from('modules').delete().eq('id', id)
  if (error) throw error
}

// ---- Aulas ----
export async function createLesson(patch: Partial<Lesson> & { module_id: string; title: string }) {
  const { error } = await supabase.from('lessons').insert(patch)
  if (error) throw error
}
export async function updateLesson(id: string, patch: Partial<Lesson>) {
  const { error } = await supabase.from('lessons').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteLesson(id: string) {
  const { error } = await supabase.from('lessons').delete().eq('id', id)
  if (error) throw error
}
