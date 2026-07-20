/**
 * Benchs — registro institucional dos benchmarks realizados.
 * Cada bench é classificado por tipo (outra EJ, pós-júnior, membro do
 * BEV, outro) e pode ter vários participantes, inclusive de EJs
 * diferentes. A pontuação é derivada do tipo + documentação e alimenta
 * a camada de gamificação da aba.
 */
import { supabase } from './supabase'

export type BenchTipo = 'ej' | 'pos_junior' | 'membro_bev' | 'outro'

export const TIPOS: BenchTipo[] = ['ej', 'pos_junior', 'membro_bev', 'outro']

export const TIPO_LABELS: Record<BenchTipo, string> = {
  ej: 'Empresa Júnior',
  pos_junior: 'Pós-júnior',
  membro_bev: 'Membro do BEV',
  outro: 'Outro',
}

export const TIPO_DESCRICAO: Record<BenchTipo, string> = {
  ej: 'Bench com membro(s) de outra empresa júnior',
  pos_junior: 'Bench com ex-membro do MEJ já no mercado',
  membro_bev: 'Bench interno, com outro membro do Bevilaqua',
  outro: 'Bench com profissional ou organização fora do MEJ',
}

/** Pontos por tipo de bench (camada de gamificação). */
export const TIPO_PONTOS: Record<BenchTipo, number> = {
  ej: 30,
  pos_junior: 50,
  membro_bev: 15,
  outro: 20,
}

export const PONTOS_DOCUMENTACAO = 20
export const PONTOS_PARTICIPANTE_EXTRA = 10
export const PONTOS_MULTI_EJ = 25

export interface BenchParticipante {
  id: string
  bench_id: string
  nome: string
  email: string | null
  organizacao: string | null
  tipo: BenchTipo
}

export interface Bench {
  id: string
  subarea_id: string
  tipo: BenchTipo
  organizacao_parceira: string | null
  membro_nome: string | null
  membro_email: string | null
  tema: string | null
  data: string
  meet_url: string | null
  insights: string | null
  aprendizados: string | null
  avaliacao: number | null
  gravacao_url: string | null
  criado_por: string
  cycle_id: string
  created_at: string
  participantes: BenchParticipante[]
}

const SELECT = '*, participantes:bench_participantes(*)'

/** Um bench é "documentado" quando tem insights registrados. */
export function isDocumentado(b: Bench): boolean {
  return !!b.insights && b.insights.trim().length > 0
}

/** Organizações externas distintas que participaram do bench. */
export function organizacoesDistintas(b: Bench): string[] {
  const orgs = b.participantes
    .map((p) => (p.organizacao ?? '').trim())
    .filter((o) => o.length > 0)
  const vistos = new Set<string>()
  const saida: string[] = []
  for (const o of orgs) {
    const k = o.toLowerCase()
    if (!vistos.has(k)) {
      vistos.add(k)
      saida.push(o)
    }
  }
  return saida
}

/** Pontuação do bench na gamificação. */
export function pontosDoBench(b: Bench): number {
  let p = TIPO_PONTOS[b.tipo] ?? 0
  if (isDocumentado(b)) p += PONTOS_DOCUMENTACAO
  const extras = Math.max(0, b.participantes.length - 1)
  p += extras * PONTOS_PARTICIPANTE_EXTRA
  if (organizacoesDistintas(b).length > 1) p += PONTOS_MULTI_EJ
  return p
}

/** Benchs do ciclo. Sem filtro de subárea = visão institucional. */
export async function getBenchs(cycleId: string, subareaIds: string[] | null): Promise<Bench[]> {
  let q = supabase
    .from('benchs')
    .select(SELECT)
    .eq('cycle_id', cycleId)
    .order('data', { ascending: false })
  if (subareaIds && subareaIds.length > 0) q = q.in('subarea_id', subareaIds)
  const { data, error } = await q
  if (error) throw error
  return ((data ?? []) as unknown as Bench[]).map((b) => ({
    ...b,
    participantes: b.participantes ?? [],
  }))
}

export interface ParticipanteInput {
  nome: string
  email?: string
  organizacao?: string
  tipo: BenchTipo
}

export async function createBench(input: {
  subarea_id: string
  tipo: BenchTipo
  tema: string
  data: string
  criado_por: string
  meet_url?: string
  participantes: ParticipanteInput[]
}): Promise<string> {
  const principal = input.participantes[0]
  const { data, error } = await supabase
    .from('benchs')
    .insert({
      subarea_id: input.subarea_id,
      tipo: input.tipo,
      tema: input.tema,
      data: input.data,
      criado_por: input.criado_por,
      meet_url: input.meet_url || null,
      organizacao_parceira: principal?.organizacao || null,
      membro_nome: principal?.nome || null,
      membro_email: principal?.email || null,
    })
    .select('id')
    .single()
  if (error) throw error

  const benchId = (data as { id: string }).id
  if (input.participantes.length > 0) {
    const { error: pErr } = await supabase.from('bench_participantes').insert(
      input.participantes.map((p) => ({
        bench_id: benchId,
        nome: p.nome,
        email: p.email || null,
        organizacao: p.organizacao || null,
        tipo: p.tipo,
      })),
    )
    if (pErr) throw pErr
  }
  return benchId
}

export async function saveBenchDocumentacao(
  id: string,
  patch: {
    insights: string
    aprendizados: string
    avaliacao: number | null
    gravacao_url?: string
  },
): Promise<void> {
  const { error } = await supabase
    .from('benchs')
    .update({
      insights: patch.insights || null,
      aprendizados: patch.aprendizados || null,
      avaliacao: patch.avaliacao,
      ...(patch.gravacao_url !== undefined ? { gravacao_url: patch.gravacao_url || null } : {}),
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteBench(id: string): Promise<void> {
  const { error } = await supabase.from('benchs').delete().eq('id', id)
  if (error) throw error
}

// ---------------- Gamificação ----------------

export interface Conquista {
  slug: string
  titulo: string
  descricao: string
  desbloqueada: boolean
  progresso: number
  alvo: number
}

/** Conquistas calculadas sobre a lista de benchs em tela. */
export function calcularConquistas(benchs: Bench[]): Conquista[] {
  const documentados = benchs.filter(isDocumentado).length
  const tipos = new Set(benchs.map((b) => b.tipo))
  const multiEj = benchs.filter((b) => organizacoesDistintas(b).length > 1).length
  const posJunior = benchs.filter((b) => b.tipo === 'pos_junior').length
  const orgs = new Set(
    benchs.flatMap((b) => organizacoesDistintas(b).map((o) => o.toLowerCase())),
  ).size

  const def = (
    slug: string,
    titulo: string,
    descricao: string,
    progresso: number,
    alvo: number,
  ): Conquista => ({
    slug,
    titulo,
    descricao,
    progresso: Math.min(progresso, alvo),
    alvo,
    desbloqueada: progresso >= alvo,
  })

  return [
    def('primeiro', 'Primeiro contato', 'Registre o primeiro bench do ciclo', benchs.length, 1),
    def('cinco', 'Rede em construção', 'Registre 5 benchs no ciclo', benchs.length, 5),
    def('dez', 'Conectado ao MEJ', 'Registre 10 benchs no ciclo', benchs.length, 10),
    def('documentador', 'Documentador', 'Documente os insights de 5 benchs', documentados, 5),
    def('poliglota', 'Repertório completo', 'Faça bench dos 4 tipos diferentes', tipos.size, 4),
    def('senior', 'Aprendiz do mercado', 'Faça 3 benchs com pós-juniores', posJunior, 3),
    def('mesa_redonda', 'Mesa redonda', 'Bench com duas EJs diferentes na mesma call', multiEj, 1),
    def('embaixador', 'Embaixador', 'Converse com 8 organizações diferentes', orgs, 8),
  ]
}

export interface Nivel {
  nivel: number
  titulo: string
  faltam: number
  base: number
  topo: number
}

/** Nível a partir da pontuação total. */
export function nivelPorPontos(pontos: number): Nivel {
  const faixas = [
    { titulo: 'Explorador', limite: 100 },
    { titulo: 'Conector', limite: 250 },
    { titulo: 'Articulador', limite: 500 },
    { titulo: 'Referência', limite: 900 },
    { titulo: 'Lenda do MEJ', limite: Number.POSITIVE_INFINITY },
  ]
  let base = 0
  for (let i = 0; i < faixas.length; i++) {
    if (pontos < faixas[i].limite) {
      return {
        nivel: i + 1,
        titulo: faixas[i].titulo,
        faltam: faixas[i].limite === Infinity ? 0 : faixas[i].limite - pontos,
        base,
        topo: faixas[i].limite === Infinity ? Math.max(pontos, base) : faixas[i].limite,
      }
    }
    base = faixas[i].limite
  }
  return { nivel: faixas.length, titulo: 'Lenda do MEJ', faltam: 0, base, topo: pontos }
}
