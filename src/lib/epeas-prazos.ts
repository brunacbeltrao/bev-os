/**
 * Cola entre o motor de prazos e o EPEAS.
 *
 * `prazos.ts` é puro e não sabe o que é contrato. Aqui ficam as consultas,
 * as ações (registrar evento, suspender, retomar, informar baseline em
 * lote) e a tradução de uma linha de `epeas_lifecycle` para a entrada que
 * o motor espera.
 */
import { supabase } from './supabase'
import {
  calcularPrazo,
  type Evento,
  type EventoTipo,
  type PrazoSituacao,
  type PrazoTipo,
  type ResultadoPrazo,
  type Suspensao,
  type SuspensaoMotivo,
} from './prazos'
import type { EpeasContrato } from './epeas'

/**
 * Evento que serve de marco zero do contrato.
 *
 * Sem assinatura registrada não há prazo jurídico possível: foi a data de
 * migração fazendo esse papel que produziu os 97% de atraso falso.
 */
export const EVENTO_BASELINE: EventoTipo = 'assinatura'

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface EventoRegistrado extends Evento {
  id: string
  contrato_id: string
  observacao: string | null
  registrado_por: { id: string; nome: string } | null
  created_at: string
}

export interface SuspensaoRegistrada extends Suspensao {
  id: string
  contrato_id: string
  justificativa: string
  iniciada_por: { id: string; nome: string } | null
  retomada_por: { id: string; nome: string } | null
  nota_retomada: string | null
}

/** Feriados como conjunto de 'AAAA-MM-DD', que é o que o motor consome. */
export async function getFeriados(): Promise<Set<string>> {
  const { data, error } = await supabase.from('feriados').select('data')
  if (error) throw error
  return new Set((data ?? []).map((f) => (f as { data: string }).data.slice(0, 10)))
}

const EVENTO_SELECT =
  'id, contrato_id, tipo, ocorrido_em, observacao, created_at, registrado_por:people!epeas_eventos_registrado_por_fkey(id, nome)'

const SUSPENSAO_SELECT =
  'id, contrato_id, motivo, justificativa, iniciada_em, retomada_em, nota_retomada, ' +
  'iniciada_por:people!epeas_suspensoes_iniciada_por_fkey(id, nome), ' +
  'retomada_por:people!epeas_suspensoes_retomada_por_fkey(id, nome)'

export async function getEventos(contratoId: string): Promise<EventoRegistrado[]> {
  const { data, error } = await supabase
    .from('epeas_eventos')
    .select(EVENTO_SELECT)
    .eq('contrato_id', contratoId)
    .order('ocorrido_em', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as EventoRegistrado[]
}

export async function getSuspensoes(contratoId: string): Promise<SuspensaoRegistrada[]> {
  const { data, error } = await supabase
    .from('epeas_suspensoes')
    .select(SUSPENSAO_SELECT)
    .eq('contrato_id', contratoId)
    .order('iniciada_em', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as SuspensaoRegistrada[]
}

/**
 * Tudo que o motor precisa para a carteira inteira, em três consultas.
 *
 * A lista calcula prazo de 32 contratos; buscar evento e suspensão por
 * contrato seriam 64 idas ao banco para desenhar uma tela.
 */
export interface ContextoPrazos {
  feriados: Set<string>
  eventos: Map<string, EventoRegistrado[]>
  suspensoes: Map<string, SuspensaoRegistrada[]>
}

export async function getContextoPrazos(): Promise<ContextoPrazos> {
  const [feriados, ev, sus] = await Promise.all([
    getFeriados(),
    supabase.from('epeas_eventos').select(EVENTO_SELECT),
    supabase.from('epeas_suspensoes').select(SUSPENSAO_SELECT),
  ])
  if (ev.error) throw ev.error
  if (sus.error) throw sus.error

  const eventos = new Map<string, EventoRegistrado[]>()
  for (const e of (ev.data ?? []) as unknown as EventoRegistrado[]) {
    const lista = eventos.get(e.contrato_id) ?? []
    lista.push(e)
    eventos.set(e.contrato_id, lista)
  }
  const suspensoes = new Map<string, SuspensaoRegistrada[]>()
  for (const s of (sus.data ?? []) as unknown as SuspensaoRegistrada[]) {
    const lista = suspensoes.get(s.contrato_id) ?? []
    lista.push(s)
    suspensoes.set(s.contrato_id, lista)
  }
  return { feriados, eventos, suspensoes }
}

export const CONTEXTO_VAZIO: ContextoPrazos = {
  feriados: new Set(),
  eventos: new Map(),
  suspensoes: new Map(),
}

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------

/** 'AAAA-MM-DD' de hoje no fuso de Recife, não no do aparelho. */
export function hojeRecife(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function temBaseline(contratoId: string, ctx: ContextoPrazos): boolean {
  return (ctx.eventos.get(contratoId) ?? []).some((e) => e.tipo === EVENTO_BASELINE)
}

// ---------------------------------------------------------------------------
// Camada 1 — PRAZO CONTRATUAL
//
// O que está na cláusula. É o que gera responsabilidade perante o cliente e
// o único que a tela pode chamar de "atrasado".
// ---------------------------------------------------------------------------

/** Prazo de entrega do contrato — o que o cliente cobra. */
export function prazoContratual(
  c: EpeasContrato,
  ctx: ContextoPrazos,
  hoje = hojeRecife(),
): ResultadoPrazo {
  const eventos = ctx.eventos.get(c.contrato_id) ?? []
  const suspensoes = ctx.suspensoes.get(c.contrato_id) ?? []
  const tipo = (c.prazo_tipo ?? 'dias_uteis_apos_evento') as PrazoTipo
  const baseline = eventos.find((e) => e.tipo === EVENTO_BASELINE)?.ocorrido_em ?? null

  return calcularPrazo({
    config: {
      tipo,
      dataFixa: c.prazo_entrega,
      diasUteis: c.prazo_dias_uteis,
      eventoGatilho: c.prazo_evento_gatilho as EventoTipo | null,
      condicao: c.prazo_condicao,
    },
    eventos,
    suspensoes,
    feriados: ctx.feriados,
    hoje,
    baseline,
  })
}

// ---------------------------------------------------------------------------
// Camada 2 — SLA INTERNO
//
// Estimativa nossa de quanto cada etapa deveria levar. Serve para a equipe
// se cobrar; nunca é o que se promete ao cliente e nunca é chamado de
// "atrasado" na tela — um contrato pode estar dentro do prazo contratual e
// acima do SLA interno ao mesmo tempo, e os dois têm que aparecer separados.
//
// Roda pelo mesmo motor da camada 1: mesma conta de dia útil, mesma
// suspensão. Se a bola está com o cliente, o relógio interno também para.
// ---------------------------------------------------------------------------

/**
 * Dias ÚTEIS esperados em cada etapa do fluxo macro.
 *
 * Não vem da planilha — é constante de código, estimativa do processo
 * interno. Até 09/09 os mesmos números eram lidos como dias CORRIDOS, o que
 * fazia um contrato parado desde sexta virar "atrasado" na segunda por causa
 * do fim de semana. `null` = etapa sem SLA (entregue não tem o que cobrar).
 */
export const SLA_ETAPA_MACRO: Record<string, number | null> = {
  comercial_contrato_fechado: 2,
  comercial_formulario_enviado: 5,
  gestao_formulario_conferido: 2,
  gestao_assessor_definido: 2,
  gestao_contrato_elaboracao: 5,
  // A bola está com o cliente para assinar. Quando passar disso, o caminho
  // é suspender com justificativa, não deixar o contador correr.
  gestao_contrato_assinatura: 5,
  gestao_contrato_assinado: 2,
  projetos_aguardando_alocacao: 3,
  projetos_alocado: 2,
  projetos_grupo_criado: 2,
  projetos_em_execucao: 30,
  projetos_entregue: null,
}

/** SLA da etapa do fluxo macro em que o contrato está. */
export function slaEtapaMacro(
  c: EpeasContrato,
  ctx: ContextoPrazos,
  hoje = hojeRecife(),
): ResultadoPrazo {
  return calcularPrazo({
    config: {
      tipo: 'dias_uteis_apos_evento',
      diasUteis: SLA_ETAPA_MACRO[c.etapa_macro] ?? null,
    },
    eventos: ctx.eventos.get(c.contrato_id) ?? [],
    suspensoes: ctx.suspensoes.get(c.contrato_id) ?? [],
    feriados: ctx.feriados,
    hoje,
    // O sistema carimba a entrada na etapa, então aqui existe baseline
    // mesmo para contrato migrado — é tempo parado na etapa, não prazo
    // jurídico. Só o contratual depende de assinatura registrada.
    baseline: (c.etapa_macro_em ?? c.created_at).slice(0, 10),
  })
}

/** SLA da etapa da trilha de execução, quando o contrato está em execução. */
export function slaEtapaServico(
  c: EpeasContrato,
  ctx: ContextoPrazos,
  hoje = hojeRecife(),
): ResultadoPrazo | null {
  if (!c.etapa_servico) return null
  return calcularPrazo({
    config: {
      tipo: (c.etapa_servico.prazo_tipo ?? 'dias_uteis_apos_evento') as PrazoTipo,
      diasUteis: c.etapa_servico.prazo_dias,
      eventoGatilho: (c.etapa_servico.evento_gatilho ?? null) as EventoTipo | null,
    },
    eventos: ctx.eventos.get(c.contrato_id) ?? [],
    suspensoes: ctx.suspensoes.get(c.contrato_id) ?? [],
    feriados: ctx.feriados,
    hoje,
    baseline: (c.etapa_servico_em ?? c.etapa_macro_em ?? c.created_at).slice(0, 10),
  })
}

/**
 * O SLA interno que vale agora: o da trilha quando existe, o do fluxo macro
 * quando não. Um contrato em execução é cobrado pela etapa da trilha, que é
 * mais específica; fora dela, pela etapa macro.
 */
export function slaDaEtapa(
  c: EpeasContrato,
  ctx: ContextoPrazos,
  hoje = hojeRecife(),
): ResultadoPrazo {
  return slaEtapaServico(c, ctx, hoje) ?? slaEtapaMacro(c, ctx, hoje)
}

/**
 * Rótulos do SLA interno.
 *
 * A palavra "atrasado" é reservada ao prazo contratual. Estourar a
 * estimativa interna é "acima do previsto": informação para a equipe se
 * organizar, não dívida com o cliente.
 */
export const SLA_LABELS: Record<PrazoSituacao, string> = {
  estourado: 'Acima do previsto',
  perto: 'No limite',
  no_prazo: 'Em dia',
  suspenso: 'Pausado',
  aguardando_gatilho: 'Aguardando gatilho',
  sem_baseline: 'Sem baseline',
  sem_prazo: 'Sem SLA',
}

/** Tom visual do SLA — nunca vermelho: vermelho é do prazo contratual. */
export const SLA_TOM: Record<PrazoSituacao, 'warning' | 'info' | 'neutral'> = {
  estourado: 'warning',
  perto: 'warning',
  no_prazo: 'neutral',
  suspenso: 'info',
  aguardando_gatilho: 'info',
  sem_baseline: 'neutral',
  sem_prazo: 'neutral',
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

export async function registrarEvento(
  contratoId: string,
  tipo: EventoTipo,
  ocorridoEm: string,
  pessoaId: string,
  observacao?: string,
) {
  const { error } = await supabase.from('epeas_eventos').insert({
    contrato_id: contratoId,
    tipo,
    ocorrido_em: ocorridoEm,
    observacao: observacao?.trim() || null,
    registrado_por: pessoaId,
  })
  if (error) throw error
}

export async function removerEvento(id: string) {
  const { error } = await supabase.from('epeas_eventos').delete().eq('id', id)
  if (error) throw error
}

export async function suspenderPrazo(
  contratoId: string,
  motivo: SuspensaoMotivo,
  justificativa: string,
  pessoaId: string,
) {
  const { error } = await supabase.from('epeas_suspensoes').insert({
    contrato_id: contratoId,
    motivo,
    justificativa: justificativa.trim(),
    iniciada_por: pessoaId,
  })
  if (error) throw error
}

export async function retomarPrazo(suspensaoId: string, pessoaId: string, nota?: string) {
  const { error } = await supabase
    .from('epeas_suspensoes')
    .update({
      retomada_em: new Date().toISOString(),
      retomada_por: pessoaId,
      nota_retomada: nota?.trim() || null,
    })
    .eq('id', suspensaoId)
    .is('retomada_em', null)
  if (error) throw error
}

/**
 * Informa o marco zero de vários contratos de uma vez.
 *
 * Os 31 migrados entraram sem nenhum evento. Pedir que alguém abra 31
 * telas para digitar a data de assinatura é o tipo de tarefa que não
 * acontece — daí a ação em lote.
 */
export async function definirBaselineEmLote(
  itens: { contratoId: string; ocorridoEm: string }[],
  pessoaId: string,
) {
  if (itens.length === 0) return
  const { error } = await supabase.from('epeas_eventos').insert(
    itens.map((i) => ({
      contrato_id: i.contratoId,
      tipo: EVENTO_BASELINE,
      ocorrido_em: i.ocorridoEm,
      observacao: 'Baseline informado em lote pela Diretoria.',
      registrado_por: pessoaId,
    })),
  )
  if (error) throw error
}
