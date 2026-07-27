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

// ---------------------------------------------------------------------------
// Lideranças por diretoria — espelham as funções de RLS do banco.
// Diretor, Gerente e Coordenador contam como liderança.
// ---------------------------------------------------------------------------

const LIDERANCA = ['diretor', 'gerente', 'coordenador'] as const

function isLideranca(occupations: Occupation[], directorateSlug: string): boolean {
  return occupations.some(
    (o) =>
      o.directorate.slug === directorateSlug &&
      (LIDERANCA as readonly string[]).includes(o.role),
  )
}

function isDiretor(occupations: Occupation[], directorateSlug: string): boolean {
  return occupations.some((o) => o.directorate.slug === directorateSlug && o.role === 'diretor')
}

/** Lideranças da Diretoria de Negócios — únicas que lançam créditos de BevCoins. */
export function canLaunchBevCoins(occupations: Occupation[]): boolean {
  return isLideranca(occupations, 'negocios')
}

/** Apenas o Diretor de Gestão atesta ou reprova resgates de BevCoins. */
export function isDiretorGestao(occupations: Occupation[]): boolean {
  return isDiretor(occupations, 'gestao')
}

/** Quem acumula BevCoins: todos menos quem lança e quem aprova. */
export function isEligibleForBevCoins(occupations: Occupation[]): boolean {
  return !canLaunchBevCoins(occupations) && !isDiretorGestao(occupations)
}

/** Lideranças de Gestão — avaliam reembolsos/investimentos e mexem no caixa. */
export function isGestaoLideranca(occupations: Occupation[]): boolean {
  return isLideranca(occupations, 'gestao')
}

/** Lideranças de Pessoas e Cultura — únicas que julgam justificativas de ausência. */
export function isPcLideranca(occupations: Occupation[]): boolean {
  return isLideranca(occupations, 'pessoas_cultura')
}
