import type { Occupation } from './org'

/** Verdadeiro se o membro for Diretor em pelo menos uma ocupação no ciclo. */
export function isDirexMember(occupations: Occupation[]): boolean {
  return occupations.some((o) => o.role === 'diretor')
}

/** Verdadeiro se o membro for liderança: Diretor, Gerente ou Coordenador. */
export function isLeaderMember(occupations: Occupation[]): boolean {
  return occupations.some(
    (o) => o.role === 'diretor' || o.role === 'gerente' || o.role === 'coordenador',
  )
}

/** Verdadeiro se o membro for de Pessoas & Cultura. */
export function isPcMember(occupations: Occupation[]): boolean {
  return occupations.some((o) => o.subarea.slug === 'pessoas_cultura')
}

/** Verdadeiro se puder gerenciar/aplicar warnings. */
export function canManageWarnings(occupations: Occupation[]): boolean {
  return isDirexMember(occupations) || isPcMember(occupations)
}

/** Retorna true se puder editar o planejamento de uma diretoria específica. */
export function canEditDirectorate(occupations: Occupation[], directorateSlug: string): boolean {
  if (isDirexMember(occupations)) return true
  return occupations.some((o) => (o.role === 'gerente' || o.role === 'coordenador') && o.directorate.slug === directorateSlug)
}
