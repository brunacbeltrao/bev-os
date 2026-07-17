/**
 * Projetos (Onda 2 / ADD §3.6) — todo projeto nasce de um lead
 * fechado no Comercial (trigger no banco), SEM núcleo: a liderança
 * de Projetos aloca Capiba/Suassuna manualmente (decisão validada).
 * Sem controle financeiro por projeto — receita vai ao caixa único.
 */
import { supabase } from './supabase'
import type { Person } from './org'

export type ProjectStatus = 'em_andamento' | 'concluido'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
}

export interface Nucleo {
  id: string
  slug: string
  nome: string
}

export interface ProjectService {
  id: string
  slug: string
  nome: string
}

export interface Project {
  id: string
  lead_id: string | null
  cliente: string
  nucleo_id: string | null
  servico_id: string | null
  status: ProjectStatus
  prazo: string | null
  cycle_id: string
  created_at: string
  nucleo: Nucleo | null
  servico: ProjectService | null
  members: Array<Pick<Person, 'id' | 'nome' | 'foto_url'>>
}

const PROJECT_SELECT =
  '*, nucleo:project_nucleos(id, slug, nome), servico:project_services(id, slug, nome), project_members(person:people(id, nome, foto_url))'

export async function getServices(): Promise<ProjectService[]> {
  const { data, error } = await supabase.from('project_services').select('id, slug, nome').order('ordem')
  if (error) throw error
  return (data ?? []) as ProjectService[]
}

function mapProject(row: Record<string, unknown>): Project {
  const members = (
    (row.project_members as Array<{ person: Project['members'][number] }>) ?? []
  ).map((m) => m.person)
  return { ...(row as unknown as Omit<Project, 'members'>), members }
}

export async function getProjects(cycleId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => mapProject(r as Record<string, unknown>))
}

/** Projetos em andamento ainda sem núcleo — fila de alocação da liderança. */
export async function getAwaitingAllocation(cycleId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('cycle_id', cycleId)
    .eq('status', 'em_andamento')
    .is('nucleo_id', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => mapProject(r as Record<string, unknown>))
}

export async function getNucleos(): Promise<Nucleo[]> {
  const { data, error } = await supabase.from('project_nucleos').select('*').order('nome')
  if (error) throw error
  return (data ?? []) as Nucleo[]
}

export async function updateProject(
  projectId: string,
  patch: { nucleo_id?: string | null; servico_id?: string | null; status?: ProjectStatus; prazo?: string | null },
): Promise<void> {
  const { error } = await supabase.from('projects').update(patch).eq('id', projectId)
  if (error) throw error
}

export async function addProjectMember(projectId: string, personId: string): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, person_id: personId })
  if (error) throw error
}

export async function removeProjectMember(projectId: string, personId: string): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('person_id', personId)
  if (error) throw error
}
