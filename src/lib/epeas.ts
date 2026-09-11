/**
 * EPEAS — ciclo de vida do contrato (Onda A).
 *
 * O ciclo de vida pendura em `contratos` (1:1 via epeas_lifecycle), então
 * cliente, serviço, valor e responsável comercial continuam vindo de uma
 * fonte única, a mesma que alimenta os dashboards.
 *
 * Quem vê e quem edita é resolvido pelo RLS (epeas_pode_ver / epeas_pode_editar).
 */
import { supabase } from './supabase'
import { ESTADO_LABELS, PAPEL_LABELS, type Alocacao, type Estado, type Papel } from './epeas-fila'

export type EtapaMacro =
  | 'comercial_contrato_fechado'
  | 'comercial_formulario_enviado'
  | 'gestao_formulario_conferido'
  | 'gestao_assessor_definido'
  | 'gestao_contrato_elaboracao'
  | 'gestao_contrato_assinatura'
  | 'gestao_contrato_assinado'
  | 'projetos_aguardando_alocacao'
  | 'projetos_alocado'
  | 'projetos_grupo_criado'
  | 'projetos_em_execucao'
  | 'projetos_entregue'

/** Ordem oficial do fluxo (PRD §3.3). O índice também mede o progresso. */
export const ETAPAS_MACRO: EtapaMacro[] = [
  'comercial_contrato_fechado',
  'comercial_formulario_enviado',
  'gestao_formulario_conferido',
  'gestao_assessor_definido',
  'gestao_contrato_elaboracao',
  'gestao_contrato_assinatura',
  'gestao_contrato_assinado',
  'projetos_aguardando_alocacao',
  'projetos_alocado',
  'projetos_grupo_criado',
  'projetos_em_execucao',
  'projetos_entregue',
]

export const ETAPA_MACRO_LABELS: Record<EtapaMacro, string> = {
  comercial_contrato_fechado: 'Contrato fechado',
  comercial_formulario_enviado: 'Formulário enviado',
  gestao_formulario_conferido: 'Formulário conferido',
  gestao_assessor_definido: 'Assessor de contrato definido',
  gestao_contrato_elaboracao: 'Contrato em elaboração',
  gestao_contrato_assinatura: 'Enviado para assinatura',
  gestao_contrato_assinado: 'Contrato assinado',
  projetos_aguardando_alocacao: 'Aguardando alocação',
  projetos_alocado: 'Alocado em núcleo',
  projetos_grupo_criado: 'Grupo de WhatsApp criado',
  projetos_em_execucao: 'Em execução',
  projetos_entregue: 'Entregue',
}

/** A qual time a etapa pertence — define de quem é a bola. */
export function faseDaEtapa(e: EtapaMacro): 'comercial' | 'gestao' | 'projetos' {
  if (e.startsWith('comercial_')) return 'comercial'
  if (e.startsWith('gestao_')) return 'gestao'
  return 'projetos'
}

export const FASE_LABELS = {
  comercial: 'Comercial',
  gestao: 'Gestão',
  projetos: 'Projetos',
} as const

// ---------------------------------------------------------------------------
// Execução — trilha configurável por serviço (PRD, Onda B).
//
// A Onda A tinha uma lista fixa de seis etapas, e só de Registro de Marca.
// Agora cada serviço tem a sua trilha em `servico_etapas`, com prazo próprio
// por etapa, vinda da aba "Configurações" da planilha do piloto. Alterar o
// processo passa a ser mexer numa tabela, não num deploy.
// ---------------------------------------------------------------------------

export interface ServicoEtapa {
  id: string
  servico_id: string
  ordem: number
  nome: string
  /**
   * SLA INTERNO da etapa, na unidade abaixo. Não é o prazo do cliente.
   * Nulo em etapa condicionada, que não tem prazo nosso a cobrar.
   */
  prazo_quantidade: number | null
  /**
   * Dias úteis quando quem executa somos nós; dias corridos quando a etapa
   * é espera por órgão público, que não conhece o nosso calendário.
   */
  unidade_prazo: string
  prazo_tipo: string | null
  /** Nulo = o prazo conta da entrada na etapa. */
  evento_gatilho: string | null
  /** Só em etapa condicionada: o que se está esperando, para a tela dizer. */
  prazo_condicao: string | null
  /** Qual papel do contrato responde por esta etapa. Ver lib/epeas-fila.ts. */
  papel_responsavel: Papel
}

const SERVICO_ETAPA_SELECT =
  'id, servico_id, ordem, nome, prazo_quantidade, unidade_prazo, prazo_tipo, ' +
  'evento_gatilho, prazo_condicao, papel_responsavel'

/**
 * Papel que responde por cada etapa do fluxo macro.
 *
 * Mora no código, não no banco, porque `etapa_macro` é um enum de código: as
 * doze etapas são o processo da EJ, não configuração por serviço. A trilha
 * de execução é o contrário — muda por serviço — e por isso o papel dela
 * vive em `servico_etapas.papel_responsavel`.
 */
export const PAPEL_ETAPA_MACRO: Record<EtapaMacro, Papel> = {
  comercial_contrato_fechado: 'comercial',
  comercial_formulario_enviado: 'comercial',
  gestao_formulario_conferido: 'gestao',
  gestao_assessor_definido: 'gestao',
  gestao_contrato_elaboracao: 'gestao',
  gestao_contrato_assinatura: 'gestao',
  gestao_contrato_assinado: 'gestao',
  projetos_aguardando_alocacao: 'gerente_nucleo',
  projetos_alocado: 'gerente_nucleo',
  projetos_grupo_criado: 'scrum_master',
  projetos_em_execucao: 'assessor_projeto',
  projetos_entregue: 'gerente_nucleo',
}

/** Trilha de um serviço, em ordem. Vazia = serviço sem trilha configurada. */
export async function getServicoEtapas(servicoId: string | null): Promise<ServicoEtapa[]> {
  if (!servicoId) return []
  const { data, error } = await supabase
    .from('servico_etapas')
    .select(SERVICO_ETAPA_SELECT)
    .eq('servico_id', servicoId)
    .order('ordem')
  if (error) throw error
  return (data ?? []) as unknown as ServicoEtapa[]
}

/**
 * Rótulos da execução da Onda A.
 *
 * A coluna `etapa_execucao` saiu do banco em 11/09 — nunca chegou a
 * carregar dado em produção. O mapa fica porque o valor continua aceito em
 * `epeas_contract_history.campo`: se uma restauração trouxer histórico
 * antigo, a linha do tempo mostra "Aguardando pagamento" em vez de
 * `gru_aguardando_pagamento` cru.
 */
const ETAPA_EXECUCAO_LEGADO: Record<string, string> = {
  gru_emitir: 'GRU a emitir',
  gru_aguardando_pagamento: 'Aguardando pagamento',
  protocolo_pendente: 'Protocolo pendente',
  protocolo_feito: 'Protocolo feito',
  acompanhamento: 'Acompanhamento',
  concluido: 'Concluído',
}

// ---------------------------------------------------------------------------

export interface EpeasContrato {
  id: string
  contrato_id: string
  gestao_responsavel_id: string | null
  nucleo_id: string | null
  gerente_nucleo_id: string | null
  assessores_projeto_ids: string[]
  scrum_master_id: string | null
  etapa_macro: EtapaMacro
  etapa_servico_id: string | null
  link_formulario_notion: string | null
  link_autentique: string | null
  link_grupo_whatsapp: string | null
  data_alocacao: string | null
  prazo_entrega: string | null
  cliente_contato_nome: string | null
  cliente_contato_email: string | null
  cliente_contato_telefone: string | null
  inpi_processo: string | null
  inpi_classe: string | null
  inpi_data_protocolo: string | null
  csat_enviado_em: string | null
  termo_enviado_em: string | null
  nf_emitida_em: string | null
  /** Prazo CONTRATUAL — a cláusula. Ver lib/prazos.ts e lib/epeas-prazos.ts. */
  prazo_tipo: string | null
  prazo_quantidade: number | null
  prazo_unidade: string | null
  /** Piso da faixa ("60 a 90"), só exibição. */
  prazo_quantidade_min: number | null
  /** Redação literal da cláusula — a prova de onde o número saiu. */
  prazo_clausula: string | null
  prazo_evento_gatilho: string | null
  prazo_condicao: string | null
  /** Estado de ciclo de vida — eixo perpendicular à etapa. */
  estado: Estado
  estado_em: string
  estado_motivo_id: string | null
  estado_observacao: string | null
  estado_motivo: { id: string; codigo: string; label: string } | null
  created_at: string
  etapa_macro_em: string
  etapa_servico_em: string | null
  contrato: {
    id: string
    cliente: string
    /** Marca do cliente, quando difere da razão social em `cliente`. */
    nome_comercial: string | null
    valor: number
    data_fechamento: string
    responsavel_id: string | null
    servico: { id: string; nome: string } | null
    responsavel: { id: string; nome: string } | null
  }
  etapa_servico: Omit<ServicoEtapa, 'servico_id'> | null
  nucleo: { id: string; nome: string; slug: string } | null
  gestao_responsavel: { id: string; nome: string } | null
  gerente_nucleo: { id: string; nome: string } | null
  scrum_master: { id: string; nome: string } | null
  excecoes_abertas: number
}

const SELECT = `
  id, contrato_id, gestao_responsavel_id, nucleo_id, gerente_nucleo_id,
  assessores_projeto_ids, scrum_master_id, etapa_macro, etapa_servico_id,
  link_formulario_notion, link_autentique, link_grupo_whatsapp,
  data_alocacao, created_at, etapa_macro_em, etapa_servico_em,
  prazo_entrega, cliente_contato_nome, cliente_contato_email,
  cliente_contato_telefone, inpi_processo, inpi_classe, inpi_data_protocolo,
  csat_enviado_em, termo_enviado_em, nf_emitida_em,
  prazo_tipo, prazo_quantidade, prazo_unidade, prazo_quantidade_min,
  prazo_clausula, prazo_evento_gatilho, prazo_condicao,
  estado, estado_em, estado_motivo_id, estado_observacao,
  estado_motivo:epeas_estado_motivos(id, codigo, label),
  contrato:contratos!inner(
    id, cliente, nome_comercial, valor, data_fechamento, responsavel_id,
    servico:project_services(id, nome),
    responsavel:people!contratos_responsavel_id_fkey(id, nome)
  ),
  etapa_servico:servico_etapas(id, ordem, nome, prazo_quantidade, unidade_prazo, prazo_tipo, evento_gatilho, prazo_condicao, papel_responsavel),
  nucleo:project_nucleos(id, nome, slug),
  gestao_responsavel:people!epeas_lifecycle_gestao_responsavel_id_fkey(id, nome),
  gerente_nucleo:people!epeas_lifecycle_gerente_nucleo_id_fkey(id, nome),
  scrum_master:people!epeas_lifecycle_scrum_master_id_fkey(id, nome)
`

/** Contratos do ciclo de vida que o usuário enxerga (o RLS faz o corte). */
export async function getEpeasContratos(): Promise<EpeasContrato[]> {
  const [{ data, error }, { data: exc, error: excErr }] = await Promise.all([
    supabase.from('epeas_lifecycle').select(SELECT).order('created_at', { ascending: false }),
    supabase.from('epeas_contract_exceptions').select('contrato_id').eq('status', 'aberto'),
  ])
  if (error) throw error
  if (excErr) throw excErr

  const abertas = new Map<string, number>()
  for (const e of exc ?? []) {
    const id = (e as { contrato_id: string }).contrato_id
    abertas.set(id, (abertas.get(id) ?? 0) + 1)
  }

  return (data ?? []).map((r) => ({
    ...(r as unknown as EpeasContrato),
    excecoes_abertas: abertas.get((r as { contrato_id: string }).contrato_id) ?? 0,
  }))
}

export async function getEpeasContrato(contratoId: string): Promise<EpeasContrato | null> {
  const { data, error } = await supabase
    .from('epeas_lifecycle')
    .select(SELECT)
    .eq('contrato_id', contratoId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const { count } = await supabase
    .from('epeas_contract_exceptions')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', contratoId)
    .eq('status', 'aberto')

  return { ...(data as unknown as EpeasContrato), excecoes_abertas: count ?? 0 }
}

/** Cria o ciclo de vida de um contrato que ainda não tem (ex.: importados). */
export async function iniciarCicloDeVida(contratoId: string) {
  const { error } = await supabase
    .from('epeas_lifecycle')
    .insert({ contrato_id: contratoId, etapa_macro: 'comercial_contrato_fechado' })
  if (error) throw error
}

export type EpeasPatch = Partial<{
  etapa_macro: EtapaMacro
  etapa_servico_id: string | null
  csat_enviado_em: string | null
  termo_enviado_em: string | null
  nf_emitida_em: string | null
  gestao_responsavel_id: string | null
  nucleo_id: string | null
  gerente_nucleo_id: string | null
  assessores_projeto_ids: string[]
  scrum_master_id: string | null
  link_formulario_notion: string | null
  link_autentique: string | null
  link_grupo_whatsapp: string | null
  data_alocacao: string | null
  prazo_entrega: string | null
  cliente_contato_nome: string | null
  cliente_contato_email: string | null
  cliente_contato_telefone: string | null
  inpi_processo: string | null
  inpi_classe: string | null
  inpi_data_protocolo: string | null
  prazo_tipo: string | null
  prazo_quantidade: number | null
  prazo_unidade: string | null
  prazo_quantidade_min: number | null
  prazo_clausula: string | null
  prazo_evento_gatilho: string | null
  prazo_condicao: string | null
}>

export async function atualizarEpeas(contratoId: string, patch: EpeasPatch) {
  const { error } = await supabase.from('epeas_lifecycle').update(patch).eq('contrato_id', contratoId)
  if (error) throw error
}

/** Avança para a etapa seguinte do fluxo macro. */
export async function avancarEtapa(
  contratoId: string,
  atual: EtapaMacro,
  servicoId?: string | null,
) {
  const i = ETAPAS_MACRO.indexOf(atual)
  const proxima = ETAPAS_MACRO[i + 1]
  if (!proxima) throw new Error('O contrato já está na última etapa.')

  const patch: EpeasPatch = { etapa_macro: proxima }
  // Ao entrar em execução, abre na primeira etapa da trilha do serviço.
  // Serviço sem trilha configurada entra em execução sem etapa, e a tela
  // avisa — melhor que travar o avanço por uma configuração que falta.
  if (proxima === 'projetos_em_execucao') {
    const trilha = await getServicoEtapas(servicoId ?? null)
    patch.etapa_servico_id = trilha[0]?.id ?? null
  }
  await atualizarEpeas(contratoId, patch)
}

/**
 * Quem fechou o contrato, do lado comercial.
 *
 * Mora em `contratos`, não aqui: é a mesma coluna que alimenta o
 * faturamento e os dashboards. Editar pelo EPEAS evita a ida ao Comercial
 * só para corrigir um nome.
 */
export async function definirResponsavelComercial(contratoId: string, pessoaId: string | null) {
  const { error } = await supabase
    .from('contratos')
    .update({ responsavel_id: pessoaId })
    .eq('id', contratoId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export type DocumentoTipo =
  | 'contrato_assinado'
  | 'procuracao'
  | 'comprovante_pagamento'
  | 'gru'
  | 'documento_cliente'
  | 'entregavel'
  | 'outro'

export const DOCUMENTO_TIPOS: DocumentoTipo[] = [
  'contrato_assinado',
  'procuracao',
  'comprovante_pagamento',
  'gru',
  'documento_cliente',
  'entregavel',
  'outro',
]

export const DOCUMENTO_LABELS: Record<DocumentoTipo, string> = {
  contrato_assinado: 'Contrato assinado',
  procuracao: 'Procuração',
  comprovante_pagamento: 'Comprovante de pagamento',
  gru: 'GRU',
  documento_cliente: 'Documento do cliente',
  entregavel: 'Entregável',
  outro: 'Outro',
}

export interface Documento {
  id: string
  contrato_id: string
  tipo: DocumentoTipo
  nome: string
  path: string
  versao: number
  /** Preenchido = esta é uma versão antiga. Null = é a vigente. */
  substituido_por: string | null
  etapa_macro: EtapaMacro | null
  observacao: string | null
  created_at: string
  enviado_por: { id: string; nome: string } | null
}

const DOCUMENTO_SELECT =
  'id, contrato_id, tipo, nome, path, versao, substituido_por, etapa_macro, ' +
  'observacao, created_at, enviado_por:people!epeas_documentos_enviado_por_fkey(id, nome)'

/** Todos os documentos, inclusive versões antigas. */
export async function getDocumentos(contratoId: string): Promise<Documento[]> {
  const { data, error } = await supabase
    .from('epeas_documentos')
    .select(DOCUMENTO_SELECT)
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Documento[]
}

/** Só o que vale hoje — é isto que o requisito olha. */
export const vigentes = (docs: Documento[]) => docs.filter((d) => d.substituido_por === null)

export async function enviarDocumento(
  contratoId: string,
  arquivo: File,
  tipo: DocumentoTipo,
  pessoaId: string,
  opcoes?: { etapaMacro?: EtapaMacro | null; observacao?: string; substitui?: Documento },
) {
  const path = `${contratoId}/${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, '_')}`
  const { error: upErr } = await supabase.storage.from('epeas').upload(path, arquivo)
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('epeas_documentos')
    .insert({
      contrato_id: contratoId,
      tipo,
      nome: arquivo.name,
      path,
      enviado_por: pessoaId,
      etapa_macro: opcoes?.etapaMacro ?? null,
      observacao: opcoes?.observacao?.trim() || null,
      versao: opcoes?.substitui ? opcoes.substitui.versao + 1 : 1,
    })
    .select('id')
    .single()
  if (error) throw error

  // A versão antiga aponta para a nova em vez de sumir. Quem precisar saber
  // o que foi enviado ao cliente em março ainda consegue chegar lá.
  if (opcoes?.substitui) {
    const { error: subErr } = await supabase
      .from('epeas_documentos')
      .update({ substituido_por: data.id })
      .eq('id', opcoes.substitui.id)
    if (subErr) throw subErr
  }
}

export async function removerDocumento(id: string, path: string) {
  const { error } = await supabase.from('epeas_documentos').delete().eq('id', id)
  if (error) throw error
  // o objeto só sai depois da linha: se o delete do banco falhar, o
  // arquivo continua alcançável em vez de virar referência quebrada
  await supabase.storage.from('epeas').remove([path])
}

/** URL temporária (60s) de um documento do bucket privado. */
export async function urlDocumento(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('epeas').createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

// ---------------------------------------------------------------------------
// Exceções
// ---------------------------------------------------------------------------

/**
 * Causa da exceção.
 *
 * Exceção sinaliza sem mudar etapa nem estado: o contrato segue onde está,
 * mas a tela mostra que há algo travando. O tipo é o que transforma trinta
 * textos livres em contagem por causa.
 */
export type ExcecaoTipo =
  | 'cliente_parado'
  | 'retrabalho'
  | 'mudanca_escopo'
  | 'problema_interno'
  | 'orgao_publico'

export const EXCECAO_TIPO_LABELS: Record<ExcecaoTipo, string> = {
  cliente_parado: 'Cliente parado',
  retrabalho: 'Retrabalho',
  mudanca_escopo: 'Mudança de escopo',
  problema_interno: 'Problema interno',
  orgao_publico: 'Órgão público',
}

export const EXCECAO_TIPOS = Object.keys(EXCECAO_TIPO_LABELS) as ExcecaoTipo[]

export interface Excecao {
  id: string
  contrato_id: string
  tipo: ExcecaoTipo
  descricao: string
  status: 'aberto' | 'resolvido'
  created_at: string
  resolved_at: string | null
  aberto_por: { id: string; nome: string } | null
}

export async function getExcecoes(contratoId: string): Promise<Excecao[]> {
  const { data, error } = await supabase
    .from('epeas_contract_exceptions')
    .select('id, contrato_id, tipo, descricao, status, created_at, resolved_at, aberto_por:people!epeas_contract_exceptions_aberto_por_id_fkey(id, nome)')
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Excecao[]
}

export async function abrirExcecao(
  contratoId: string,
  tipo: ExcecaoTipo,
  descricao: string,
  pessoaId: string,
) {
  const { error } = await supabase
    .from('epeas_contract_exceptions')
    .insert({ contrato_id: contratoId, tipo, descricao, aberto_por_id: pessoaId })
  if (error) throw error
}

/** Contagem por causa — o relatório que o tipo existe para permitir. */
export async function getCausasDeExcecao(): Promise<{ tipo: ExcecaoTipo; abertas: number; total: number }[]> {
  const { data, error } = await supabase
    .from('epeas_contract_exceptions')
    .select('tipo, status')
  if (error) throw error

  const mapa = new Map<ExcecaoTipo, { abertas: number; total: number }>()
  for (const t of EXCECAO_TIPOS) mapa.set(t, { abertas: 0, total: 0 })
  for (const e of (data ?? []) as { tipo: ExcecaoTipo; status: string }[]) {
    const at = mapa.get(e.tipo)
    if (!at) continue
    at.total += 1
    if (e.status === 'aberto') at.abertas += 1
  }
  return [...mapa].map(([tipo, v]) => ({ tipo, ...v })).sort((a, b) => b.abertas - a.abertas)
}

export async function resolverExcecao(id: string) {
  const { error } = await supabase
    .from('epeas_contract_exceptions')
    .update({ status: 'resolvido', resolved_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

/**
 * O que o histórico observa.
 *
 * Até 11/09 só via etapa. Alocação, prazo, suspensão, documento, estado e
 * dispensa aconteciam sem deixar linha — e é deste log que os indicadores
 * vão sair: tempo por etapa, causa de atraso, quantas vezes um contrato
 * trocou de gerente. Nada disso é reconstituível se o log não viu.
 */
export type HistoricoCampo =
  | 'etapa_macro'
  | 'etapa_execucao'
  | 'etapa_servico'
  | 'alocacao'
  | 'prazo'
  | 'suspensao'
  | 'documento'
  | 'estado'
  | 'requisito_dispensado'

export const HISTORICO_CAMPO_LABELS: Record<HistoricoCampo, string> = {
  etapa_macro: 'Etapa',
  etapa_execucao: 'Execução (legado)',
  etapa_servico: 'Etapa da trilha',
  alocacao: 'Alocação',
  prazo: 'Prazo contratual',
  suspensao: 'Suspensão de prazo',
  documento: 'Documento',
  estado: 'Estado do contrato',
  requisito_dispensado: 'Requisito dispensado',
}

export interface HistoricoItem {
  id: string
  campo: HistoricoCampo
  valor_anterior: string | null
  valor_novo: string | null
  /** Contexto que não cabe em antes/depois: papel, motivo, justificativa. */
  detalhe: Record<string, unknown> | null
  created_at: string
  alterado_por: { id: string; nome: string } | null
}

export async function getHistorico(contratoId: string): Promise<HistoricoItem[]> {
  const { data, error } = await supabase
    .from('epeas_contract_history')
    .select('id, campo, valor_anterior, valor_novo, detalhe, created_at, alterado_por:people!epeas_contract_history_alterado_por_id_fkey(id, nome)')
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as HistoricoItem[]
}

/** Rótulo legível de um valor do histórico, seja ele etapa, estado ou nome. */
export function rotuloHistorico(campo: HistoricoCampo, valor: string | null): string {
  if (!valor) return '—'
  if (campo === 'etapa_macro') return ETAPA_MACRO_LABELS[valor as EtapaMacro] ?? valor
  if (campo === 'estado') return ESTADO_LABELS[valor as Estado] ?? valor
  // A trilha grava o nome da etapa já legível; só o legado precisa de mapa.
  if (campo === 'etapa_execucao') return ETAPA_EXECUCAO_LEGADO[valor] ?? valor
  return valor
}

/** Uma linha do histórico em uma frase, já com o contexto do `detalhe`. */
export function fraseHistorico(h: HistoricoItem): string {
  const de = rotuloHistorico(h.campo, h.valor_anterior)
  const para = rotuloHistorico(h.campo, h.valor_novo)
  const d = (h.detalhe ?? {}) as Record<string, string | number | null>

  switch (h.campo) {
    case 'alocacao': {
      const papel = d.papel ? (PAPEL_LABELS[d.papel as Papel] ?? String(d.papel)) : 'Alocação'
      return h.valor_novo ? `${papel}: ${de} → ${para}` : `${papel}: ${de} removido`
    }
    case 'documento': {
      const acao = d.acao === 'removido' ? 'removeu' : d.acao === 'substituido' ? 'substituiu' : 'anexou'
      const tipo = d.tipo ? DOCUMENTO_LABELS[d.tipo as DocumentoTipo] ?? String(d.tipo) : 'documento'
      return `${acao} ${tipo}${d.versao ? ` (v${d.versao})` : ''}: ${h.valor_novo ?? h.valor_anterior}`
    }
    case 'suspensao':
      return d.justificativa ? `${para} — ${d.justificativa}` : para
    case 'estado':
      return `${de} → ${para}${d.motivo ? ` (${d.motivo})` : ''}`
    case 'requisito_dispensado':
      return `${de} dispensado${d.justificativa ? ` — ${d.justificativa}` : ''}`
    case 'prazo':
      return `${de || 'sem prazo'} → ${para}`
    default:
      return `${de} → ${para}`
  }
}

// ===========================================================================
// Estado de ciclo de vida
// ===========================================================================

export interface EstadoMotivo {
  id: string
  estado: Estado
  codigo: string
  label: string
  ordem: number
}

export async function getEstadoMotivos(): Promise<EstadoMotivo[]> {
  const { data, error } = await supabase
    .from('epeas_estado_motivos')
    .select('id, estado, codigo, label, ordem')
    .eq('ativo', true)
    .order('estado')
    .order('ordem')
  if (error) throw error
  return (data ?? []) as EstadoMotivo[]
}

/**
 * Muda o estado do contrato.
 *
 * O motivo é obrigatório fora de `em_execucao`, e o banco confere que ele
 * pertence ao estado escolhido — não dá para marcar concluído com motivo de
 * inadimplência. A sincronia com `contratos.status` é feita por gatilho, para
 * que faturamento e execução nunca discordem.
 */
export async function mudarEstado(
  contratoId: string,
  estado: Estado,
  motivoId: string | null,
  observacao?: string,
) {
  const { error } = await supabase
    .from('epeas_lifecycle')
    .update({
      estado,
      estado_motivo_id: estado === 'em_execucao' ? null : motivoId,
      estado_observacao: observacao?.trim() || null,
    })
    .eq('contrato_id', contratoId)
  if (error) throw error
}

// ===========================================================================
// Requisitos que travam a saída da etapa
// ===========================================================================

export type RequisitoTipo = 'documento' | 'campo'

export interface Requisito {
  id: string
  etapa_macro: EtapaMacro | null
  servico_etapa_id: string | null
  tipo: RequisitoTipo
  documento_tipo: DocumentoTipo | null
  campo: string | null
  label: string
  ajuda: string | null
  obrigatorio: boolean
  ordem: number
}

export interface Dispensa {
  id: string
  contrato_id: string
  requisito_id: string
  justificativa: string
  created_at: string
  dispensado_por: { id: string; nome: string } | null
}

export async function getRequisitos(): Promise<Requisito[]> {
  const { data, error } = await supabase
    .from('epeas_requisitos')
    .select('id, etapa_macro, servico_etapa_id, tipo, documento_tipo, campo, label, ajuda, obrigatorio, ordem')
    .order('ordem')
  if (error) throw error
  return (data ?? []) as Requisito[]
}

export async function getDispensas(contratoId: string): Promise<Dispensa[]> {
  const { data, error } = await supabase
    .from('epeas_requisito_dispensas')
    .select('id, contrato_id, requisito_id, justificativa, created_at, dispensado_por:people!epeas_requisito_dispensas_dispensado_por_fkey(id, nome)')
    .eq('contrato_id', contratoId)
  if (error) throw error
  return (data ?? []) as unknown as Dispensa[]
}

export async function dispensarRequisito(
  contratoId: string,
  requisitoId: string,
  justificativa: string,
  pessoaId: string,
) {
  const { error } = await supabase.from('epeas_requisito_dispensas').insert({
    contrato_id: contratoId,
    requisito_id: requisitoId,
    justificativa: justificativa.trim(),
    dispensado_por: pessoaId,
  })
  if (error) throw error
}

/** Um requisito pendente, já com o motivo de estar pendente. */
export interface Pendencia {
  requisito: Requisito
  /** 'documento' = falta anexar; 'campo' = falta preencher. */
  falta: RequisitoTipo
}

/**
 * O que impede o contrato de sair da etapa atual.
 *
 * Só olha requisito obrigatório e não dispensado. Documento conta apenas se
 * for a versão vigente — substituído não cumpre requisito.
 */
export function pendenciasDeRequisito(
  c: EpeasContrato,
  requisitos: Requisito[],
  documentos: Documento[],
  dispensas: Dispensa[],
): Pendencia[] {
  const dispensados = new Set(dispensas.map((d) => d.requisito_id))
  const tiposAnexados = new Set(vigentes(documentos).map((d) => d.tipo))

  const daEtapa = requisitos.filter(
    (r) =>
      r.obrigatorio &&
      !dispensados.has(r.id) &&
      (r.etapa_macro === c.etapa_macro ||
        (r.servico_etapa_id !== null && r.servico_etapa_id === c.etapa_servico_id)),
  )

  return daEtapa
    .filter((r) => {
      if (r.tipo === 'documento') return !tiposAnexados.has(r.documento_tipo!)
      return !valorDoCampo(c, r.campo!)
    })
    .map((r) => ({ requisito: r, falta: r.tipo }))
    .sort((a, b) => a.requisito.ordem - b.requisito.ordem)
}

/** Lê um campo de requisito, que pode morar no ciclo de vida ou no contrato. */
function valorDoCampo(c: EpeasContrato, campo: string): boolean {
  const doLifecycle = (c as unknown as Record<string, unknown>)[campo]
  if (doLifecycle !== undefined && doLifecycle !== null && doLifecycle !== '') return true
  const doContrato = (c.contrato as unknown as Record<string, unknown>)[campo]
  return doContrato !== undefined && doContrato !== null && doContrato !== ''
}

/**
 * Documentos e dispensas da carteira inteira, em duas consultas.
 *
 * A home calcula requisito pendente de 32 contratos; buscar documento e
 * dispensa por contrato seriam 64 idas ao banco para desenhar uma tela.
 */
export async function getCarteiraDocsEDispensas(): Promise<{
  documentos: Map<string, Documento[]>
  dispensas: Map<string, Set<string>>
}> {
  const [docs, disp] = await Promise.all([
    supabase.from('epeas_documentos').select(DOCUMENTO_SELECT),
    supabase.from('epeas_requisito_dispensas').select('contrato_id, requisito_id'),
  ])
  if (docs.error) throw docs.error
  if (disp.error) throw disp.error

  const documentos = new Map<string, Documento[]>()
  for (const d of (docs.data ?? []) as unknown as Documento[]) {
    const lista = documentos.get(d.contrato_id) ?? []
    lista.push(d)
    documentos.set(d.contrato_id, lista)
  }

  const dispensas = new Map<string, Set<string>>()
  for (const d of (disp.data ?? []) as { contrato_id: string; requisito_id: string }[]) {
    const set = dispensas.get(d.contrato_id) ?? new Set<string>()
    set.add(d.requisito_id)
    dispensas.set(d.contrato_id, set)
  }
  return { documentos, dispensas }
}

/** A alocação do contrato no formato que o motor de fila consome. */
export function alocacaoDe(c: EpeasContrato): Alocacao {
  return {
    comercial: c.contrato.responsavel_id,
    gestao: c.gestao_responsavel_id,
    gerente_nucleo: c.gerente_nucleo_id,
    scrum_master: c.scrum_master_id,
    assessor_projeto: c.assessores_projeto_ids ?? [],
  }
}

/** Qual papel responde pela etapa em que o contrato está agora. */
export function papelDaEtapaAtual(c: EpeasContrato): Papel {
  return c.etapa_servico?.papel_responsavel ?? PAPEL_ETAPA_MACRO[c.etapa_macro]
}

// Prazo NÃO se calcula aqui. Todo cálculo de decorrido, vencimento e atraso
// mora em `lib/prazos.ts`, e a ligação com o contrato em `lib/epeas-prazos.ts`.
// Este arquivo já teve três contas de prazo próprias (statusEtapa,
// statusEtapaServico, statusPrazo) que se contradiziam na mesma tela: o
// indicador dizia "Atrasados: 0" com 31 cartões vermelhos embaixo.
// `prazos.motor-unico.test.ts` falha se voltar a existir aritmética de dia
// fora do motor.

// ===========================================================================
// Checklist por etapa — define o que é "pronto"
// ===========================================================================

/**
 * Item do template, agora vindo de `checklist_itens`.
 *
 * O template era uma constante aqui, invisível para o banco: nada impedia
 * gravar um item que não existe, ou um item de outra etapa. Com a tabela e
 * a FK composta, mudar o processo virou mexer numa linha em vez de num
 * deploy — mesmo caminho que a trilha de serviços já tinha seguido.
 */
export interface ItemChecklist {
  id: string
  etapa: EtapaMacro
  item_key: string
  label: string
  /** trava o avanço da etapa enquanto não estiver feito */
  obrigatorio: boolean
  ordem: number
}

/** Template inteiro, agrupado por etapa. São 20 itens — cabe numa consulta. */
export async function getChecklistTemplate(): Promise<Map<EtapaMacro, ItemChecklist[]>> {
  const { data, error } = await supabase
    .from('checklist_itens')
    .select('id, etapa, item_key, label, obrigatorio, ordem')
    .order('etapa')
    .order('ordem')
  if (error) throw error

  const porEtapa = new Map<EtapaMacro, ItemChecklist[]>()
  for (const i of (data ?? []) as ItemChecklist[]) {
    const lista = porEtapa.get(i.etapa) ?? []
    lista.push(i)
    porEtapa.set(i.etapa, lista)
  }
  return porEtapa
}

export interface ChecklistFeito {
  etapa: EtapaMacro
  item_key: string
  feito_em: string
  feito_por: { id: string; nome: string } | null
}

export async function getChecklist(contratoId: string): Promise<ChecklistFeito[]> {
  const { data, error } = await supabase
    .from('epeas_checklist_done')
    .select('etapa, item_key, feito_em, feito_por:people!epeas_checklist_done_feito_por_fkey(id, nome)')
    .eq('contrato_id', contratoId)
  if (error) throw error
  return (data ?? []) as unknown as ChecklistFeito[]
}

export async function marcarItem(
  contratoId: string,
  etapa: EtapaMacro,
  itemKey: string,
  pessoaId: string,
) {
  const { error } = await supabase
    .from('epeas_checklist_done')
    .insert({ contrato_id: contratoId, etapa, item_key: itemKey, feito_por: pessoaId })
  if (error) throw error
}

export async function desmarcarItem(contratoId: string, etapa: EtapaMacro, itemKey: string) {
  const { error } = await supabase
    .from('epeas_checklist_done')
    .delete()
    .eq('contrato_id', contratoId)
    .eq('etapa', etapa)
    .eq('item_key', itemKey)
  if (error) throw error
}

/** O que ainda falta na etapa atual para poder avançar. */
export function pendenciasDaEtapa(
  etapa: EtapaMacro,
  itens: ItemChecklist[],
  feitos: ChecklistFeito[],
): ItemChecklist[] {
  const marcados = new Set(feitos.filter((f) => f.etapa === etapa).map((f) => f.item_key))
  return itens.filter((i) => i.obrigatorio && !marcados.has(i.item_key))
}

// ===========================================================================
// Conversa
// ===========================================================================

export interface Comentario {
  id: string
  contrato_id: string
  corpo: string
  mencoes: string[]
  anexo_path: string | null
  anexo_nome: string | null
  created_at: string
  edited_at: string | null
  autor: { id: string; nome: string; foto_url: string | null } | null
}

export async function getComentarios(contratoId: string): Promise<Comentario[]> {
  const { data, error } = await supabase
    .from('epeas_comments')
    .select('id, contrato_id, corpo, mencoes, anexo_path, anexo_nome, created_at, edited_at, autor:people!epeas_comments_autor_id_fkey(id, nome, foto_url)')
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Comentario[]
}

/** Extrai @menções do texto casando com o diretório de pessoas. */
export function extrairMencoes(corpo: string, pessoas: { id: string; nome: string }[]): string[] {
  const ids = new Set<string>()
  for (const p of pessoas) {
    const primeiro = p.nome.split(' ')[0]
    if (!primeiro) continue
    // @Nome ou @Nome Sobrenome, sem diferenciar acento de caixa
    const re = new RegExp(`@${primeiro}\\b`, 'i')
    if (re.test(corpo)) ids.add(p.id)
  }
  return [...ids]
}

export async function comentar(
  contratoId: string,
  autorId: string,
  corpo: string,
  mencoes: string[],
  anexo?: { path: string; nome: string },
) {
  const { error } = await supabase.from('epeas_comments').insert({
    contrato_id: contratoId,
    autor_id: autorId,
    corpo,
    mencoes,
    anexo_path: anexo?.path ?? null,
    anexo_nome: anexo?.nome ?? null,
  })
  if (error) throw error
}

export async function enviarAnexo(contratoId: string, arquivo: File) {
  const path = `${contratoId}/${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, '_')}`
  const { error } = await supabase.storage.from('epeas').upload(path, arquivo)
  if (error) throw error
  return { path, nome: arquivo.name }
}

/**
 * URL temporária do anexo.
 *
 * O bucket `epeas` é privado: comprovante de pagamento, GRU e print de
 * conversa com cliente não podem ficar legíveis para quem tiver o link.
 * A URL assinada vale 60s — tempo de abrir, não de circular.
 *
 * Quem não enxerga o contrato não assina o anexo: a policy de storage
 * chama epeas_pode_ver sobre a pasta (<contrato_id>/...), o mesmo teste
 * que o RLS das tabelas usa.
 */
export async function urlAnexo(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('epeas')
    .createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

// ===========================================================================
// Leitura / não-lidos
// ===========================================================================

export async function marcarLido(contratoId: string, pessoaId: string) {
  const { error } = await supabase
    .from('epeas_reads')
    .upsert(
      { contrato_id: contratoId, person_id: pessoaId, last_read_at: new Date().toISOString() },
      { onConflict: 'contrato_id,person_id' },
    )
  if (error) throw error
}

export interface ResumoConversa {
  /** contrato_id -> nº de comentários não lidos */
  naoLidos: Map<string, number>
  /** contrato_id -> última menção a mim ainda não lida */
  mencionado: Set<string>
}

/** Uma consulta só para o badge de não-lidos de toda a lista. */
export async function getResumoConversa(pessoaId: string): Promise<ResumoConversa> {
  const [{ data: coments, error: e1 }, { data: reads, error: e2 }] = await Promise.all([
    supabase.from('epeas_comments').select('contrato_id, autor_id, mencoes, created_at'),
    supabase.from('epeas_reads').select('contrato_id, last_read_at').eq('person_id', pessoaId),
  ])
  if (e1) throw e1
  if (e2) throw e2

  const lidoEm = new Map<string, number>()
  for (const r of reads ?? []) {
    lidoEm.set((r as any).contrato_id, new Date((r as any).last_read_at).getTime())
  }

  const naoLidos = new Map<string, number>()
  const mencionado = new Set<string>()
  for (const c of coments ?? []) {
    const cc = c as any
    if (cc.autor_id === pessoaId) continue
    const t = new Date(cc.created_at).getTime()
    if (t <= (lidoEm.get(cc.contrato_id) ?? 0)) continue
    naoLidos.set(cc.contrato_id, (naoLidos.get(cc.contrato_id) ?? 0) + 1)
    if ((cc.mencoes ?? []).includes(pessoaId)) mencionado.add(cc.contrato_id)
  }
  return { naoLidos, mencionado }
}
