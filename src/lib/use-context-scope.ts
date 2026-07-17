/**
 * Escopo de dados do Seletor de Contexto (Blueprint §2): o contexto
 * muda o filtro aplicado dentro de cada módulo, não a lista de módulos.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useApp } from './app-context'
import type { Subarea } from './org'

export function useAllSubareas() {
  return useQuery({
    queryKey: ['subareas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subareas')
        .select('id, slug, nome, directorate_id')
      if (error) throw error
      return data as Subarea[]
    },
    staleTime: Infinity,
  })
}

export interface ContextScope {
  /** null = BEV inteiro (Visão Geral / Direx). */
  subareaIds: string[] | null
  /** Subáreas do escopo atual (vazio enquanto carrega). */
  scopeSubareas: Subarea[]
  allSubareas: Subarea[]
  /** true se o usuário lidera a subárea (gerente/coordenador dela, ou diretor da diretoria dona). */
  leadsSubarea: (subareaId: string) => boolean
}

export function useContextScope(): ContextScope {
  const { occupations } = useApp()
  const subareasQ = useAllSubareas()
  const all = subareasQ.data ?? []
  
  const scopeSubareas = all

  // Retorna null para sinalizar "escopo global / o que o RLS permitir ver"
  const subareaIds: string[] | null = null

  function leadsSubarea(subareaId: string): boolean {
    const sub = all.find((s) => s.id === subareaId)
    return occupations.some(
      (o) =>
        (o.subarea.id === subareaId && (o.role === 'gerente' || o.role === 'coordenador')) ||
        (o.role === 'diretor' && sub && o.directorate.id === sub.directorate_id),
    )
  }

  return { subareaIds, scopeSubareas, allSubareas: all, leadsSubarea }
}

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
