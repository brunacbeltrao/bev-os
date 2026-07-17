/**
 * Núcleo de identidade (Onda 0) — tipos e consultas.
 * Um arquivo por módulo em src/lib/, espelhando a Central da Direx (ADD §1).
 */
import { supabase } from './supabase'

// ---------- Tipos ----------

export type RoleType = 'diretor' | 'gerente' | 'coordenador' | 'analista' | 'assessor'

export const ROLE_LABELS: Record<RoleType, string> = {
  diretor: 'Diretor(a)',
  gerente: 'Gerente',
  coordenador: 'Coordenador(a)',
  analista: 'Analista de Área',
  assessor: 'Assessor(a)',
}

export interface Cycle {
  id: string
  nome: string
  data_inicio: string
  data_fim: string
  is_current: boolean
}

export interface Directorate {
  id: string
  slug: string
  nome: string
}

export interface Subarea {
  id: string
  slug: string
  nome: string
  directorate_id: string
}

export interface Person {
  id: string
  nome: string
  email: string
  foto_url: string | null
  entrou_em: string
  created_at: string
}

export interface Occupation {
  id: string
  person_id: string
  role: RoleType
  is_hibrido: boolean
  cycle_id: string
  subarea: Subarea
  directorate: Directorate
}

/**
 * Rótulo de área de um vínculo: Diretores respondem pela DIRETORIA
 * inteira (ex: "Negócios"), não pela subárea nominal do vínculo.
 */
export function occupationAreaLabel(occ: Pick<Occupation, 'role' | 'subarea' | 'directorate'>): string {
  return occ.role === 'diretor' ? occ.directorate.nome : occ.subarea.nome
}

export interface RosterCheck {
  status: 'ok' | 'claimed' | 'not_found'
  nome?: string
  cargo?: RoleType
  area?: string
  diretoria?: string
}

const OCCUPATION_SELECT =
  'id, person_id, role, is_hibrido, cycle_id, subarea:subareas(id, slug, nome, directorate_id), directorate:directorates(id, slug, nome)'

// ---------- Consultas ----------

export async function getCurrentCycle(): Promise<Cycle> {
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .eq('is_current', true)
    .single()
  if (error) throw error
  return data as Cycle
}

export async function getPerson(id: string): Promise<Person | null> {
  const { data, error } = await supabase.from('people').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Person | null
}

export async function getMyOccupations(personId: string, cycleId: string): Promise<Occupation[]> {
  const { data, error } = await supabase
    .from('occupations')
    .select(OCCUPATION_SELECT)
    .eq('person_id', personId)
    .eq('cycle_id', cycleId)
    .order('is_hibrido', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Occupation[]
}

export interface DirectoryEntry {
  occupation: Occupation
  person: Person
}

/** Diretório de pessoas; se subareaId for null, retorna o BEV inteiro. */
export async function getDirectory(
  cycleId: string,
  subareaId: string | null,
): Promise<DirectoryEntry[]> {
  let query = supabase
    .from('occupations')
    .select(`${OCCUPATION_SELECT}, person:people(id, nome, email, foto_url, entrou_em, created_at)`)
    .eq('cycle_id', cycleId)
  if (subareaId) query = query.eq('subarea_id', subareaId)
  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<Occupation & { person: Person }>
  return rows
    .map((r) => ({ occupation: r, person: r.person }))
    .sort((a, b) => a.person.nome.localeCompare(b.person.nome, 'pt-BR'))
}

export interface OrgStats {
  totalMembros: number
  porDiretoria: Array<{ diretoria: string; total: number }>
}

export async function getOrgStats(cycleId: string): Promise<OrgStats> {
  const { data, error } = await supabase
    .from('occupations')
    .select('person_id, is_hibrido, directorate:directorates(nome)')
    .eq('cycle_id', cycleId)
  if (error) throw error
  const rows = (data ?? []) as unknown as Array<{
    person_id: string
    is_hibrido: boolean
    directorate: { nome: string }
  }>
  const membros = new Set(rows.map((r) => r.person_id))
  const porDiretoria = new Map<string, number>()
  for (const r of rows) {
    if (r.is_hibrido) continue // conta cada pessoa só na área principal
    porDiretoria.set(r.directorate.nome, (porDiretoria.get(r.directorate.nome) ?? 0) + 1)
  }
  return {
    totalMembros: membros.size,
    porDiretoria: [...porDiretoria.entries()]
      .map(([diretoria, total]) => ({ diretoria, total }))
      .sort((a, b) => b.total - a.total),
  }
}

/** Feed de atividade recente da Onda 0: entradas no sistema. */
export async function getRecentPeople(limit = 6): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Person[]
}

// ---------- Busca global ----------

export interface SearchResult {
  kind: 'pessoa' | 'area' | 'diretoria' | 'demanda' | 'comunicado' | 'lead' | 'projeto'
  id: string
  titulo: string
  subtitulo: string
}

export async function globalSearch(q: string, cycleId: string): Promise<SearchResult[]> {
  const term = q.trim()
  if (term.length < 2) return []
  const pattern = `%${term}%`

  const [peopleRes, subareasRes, directoratesRes, demandsRes, announcementsRes, leadsRes, projectsRes] =
    await Promise.all([
      supabase
        .from('people')
        .select('id, nome, email')
        .or(`nome.ilike.${pattern},email.ilike.${pattern}`)
        .limit(8),
      supabase.from('subareas').select('id, nome, slug').ilike('nome', pattern).limit(4),
      supabase.from('directorates').select('id, nome, slug').ilike('nome', pattern).limit(4),
      supabase
        .from('demands')
        .select('id, titulo, status')
        .eq('cycle_id', cycleId)
        .ilike('titulo', pattern)
        .limit(5),
      supabase
        .from('announcements')
        .select('id, titulo, created_at')
        .eq('cycle_id', cycleId)
        .or(`titulo.ilike.${pattern},texto.ilike.${pattern}`)
        .limit(5),
      supabase
        .from('leads')
        .select('id, nome_cliente, etapa_atual')
        .eq('cycle_id', cycleId)
        .ilike('nome_cliente', pattern)
        .limit(4),
      supabase
        .from('projects')
        .select('id, cliente, status')
        .eq('cycle_id', cycleId)
        .ilike('cliente', pattern)
        .limit(4),
    ])

  const results: SearchResult[] = []

  if (peopleRes.data && peopleRes.data.length > 0) {
    const ids = peopleRes.data.map((p) => p.id)
    const { data: occs } = await supabase
      .from('occupations')
      .select('person_id, role, is_hibrido, subarea:subareas(nome), directorate:directorates(nome)')
      .eq('cycle_id', cycleId)
      .eq('is_hibrido', false)
      .in('person_id', ids)
    const occByPerson = new Map(
      (
        (occs ?? []) as unknown as Array<{
          person_id: string
          role: RoleType
          subarea: { nome: string }
          directorate: { nome: string }
        }>
      ).map((o) => [o.person_id, o]),
    )
    for (const p of peopleRes.data) {
      const occ = occByPerson.get(p.id)
      const area = occ ? (occ.role === 'diretor' ? occ.directorate.nome : occ.subarea.nome) : null
      results.push({
        kind: 'pessoa',
        id: p.id,
        titulo: p.nome,
        subtitulo: occ && area ? `${ROLE_LABELS[occ.role]} · ${area}` : p.email,
      })
    }
  }
  for (const s of subareasRes.data ?? []) {
    results.push({ kind: 'area', id: s.id, titulo: s.nome, subtitulo: 'Área' })
  }
  for (const d of directoratesRes.data ?? []) {
    results.push({ kind: 'diretoria', id: d.id, titulo: d.nome, subtitulo: 'Diretoria' })
  }
  for (const d of demandsRes.data ?? []) {
    results.push({ kind: 'demanda', id: d.id, titulo: d.titulo, subtitulo: 'Demanda' })
  }
  for (const a of announcementsRes.data ?? []) {
    results.push({ kind: 'comunicado', id: a.id, titulo: a.titulo, subtitulo: 'Aviso' })
  }
  for (const l of leadsRes.data ?? []) {
    results.push({ kind: 'lead', id: l.id, titulo: l.nome_cliente, subtitulo: 'Lead · Comercial' })
  }
  for (const p of projectsRes.data ?? []) {
    results.push({ kind: 'projeto', id: p.id, titulo: p.cliente, subtitulo: 'Projeto' })
  }
  return results
}

// ---------- Cadastro ----------

export async function checkRosterEmail(email: string): Promise<RosterCheck> {
  const { data, error } = await supabase.rpc('check_roster_email', {
    p_email: email.trim().toLowerCase(),
  })
  if (error) throw error
  return data as RosterCheck
}
