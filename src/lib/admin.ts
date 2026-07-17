import { supabase } from './supabase'
import type { RoleType } from './org'

export interface RosterEntry {
  email: string
  nome: string
  role: RoleType
  directorate_id: string
  subarea_id: string
}

/**
 * Encerrar o ciclo atual e criar um novo.
 */
export async function closeAndOpenCycle(novo_nome: string, d_inicio: string, d_fim: string, b_rollover_roster: boolean = true) {
  const { data, error } = await supabase.rpc('close_and_open_cycle', {
    novo_nome,
    d_inicio,
    d_fim,
    b_rollover_roster,
  })
  if (error) throw error
  return data // UUID do novo ciclo
}

/**
 * Adicionar múltiplos membros à lista de aprovados de um ciclo.
 */
export async function addRosterMembers(cycle_id: string, members: RosterEntry[]) {
  const entries = members.map((m) => ({
    ...m,
    email: m.email.toLowerCase(),
    cycle_id,
    claimed: false,
  }))

  const { error } = await supabase.from('approved_roster').insert(entries)
  if (error) throw error
}

/**
 * Buscar todos os membros no Roster do ciclo atual (incluindo status de ativação)
 */
export async function getRoster(cycle_id: string) {
  const { data, error } = await supabase
    .from('approved_roster')
    .select(`
      email,
      nome,
      role,
      claimed,
      claimed_at,
      directorates ( nome ),
      subareas ( nome )
    `)
    .eq('cycle_id', cycle_id)
    .order('nome', { ascending: true })

  if (error) throw error
  return data
}

export async function getAllDirectorates() {
  const { data, error } = await supabase.from('directorates').select('id, slug, nome')
  if (error) throw error
  return data
}

export async function getAllSubareas() {
  const { data, error } = await supabase
    .from('subareas')
    .select('id, directorate_id, slug, nome')
  if (error) throw error
  return data
}

export async function getSystemSettings() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .order('key', { ascending: true })
  if (error) throw error
  return data
}

export async function updateSystemSetting(key: string, value: unknown) {
  const { error } = await supabase
    .from('system_settings')
    .update({ value })
    .eq('key', key)
  if (error) throw error
}

// --------------------------------------------------------
// Estrutura Organizacional
// --------------------------------------------------------

export async function createDirectorate(nome: string, slug: string) {
  const { error } = await supabase.from('directorates').insert([{ nome, slug }])
  if (error) throw error
}

export async function updateDirectorate(id: string, nome: string, slug: string) {
  const { error } = await supabase.from('directorates').update({ nome, slug }).eq('id', id)
  if (error) throw error
}

export async function createSubarea(directorate_id: string, nome: string, slug: string) {
  const { error } = await supabase.from('subareas').insert([{ directorate_id, nome, slug }])
  if (error) throw error
}

export async function updateSubarea(id: string, nome: string, slug: string) {
  const { error } = await supabase.from('subareas').update({ nome, slug }).eq('id', id)
  if (error) throw error
}
