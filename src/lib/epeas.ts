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
// Execução — fixo a Registro de Marca nesta onda (PRD §3.4 e §5).
// Onda B troca por fluxo configurável por serviço.
// ---------------------------------------------------------------------------

export type EtapaExecucao =
  | 'gru_emitir'
  | 'gru_aguardando_pagamento'
  | 'protocolo_pendente'
  | 'protocolo_feito'
  | 'acompanhamento'
  | 'concluido'

export const ETAPAS_EXECUCAO: EtapaExecucao[] = [
  'gru_emitir',
  'gru_aguardando_pagamento',
  'protocolo_pendente',
  'protocolo_feito',
  'acompanhamento',
  'concluido',
]

export const ETAPA_EXECUCAO_LABELS: Record<EtapaExecucao, string> = {
  gru_emitir: 'GRU a emitir',
  gru_aguardando_pagamento: 'Aguardando pagamento',
  protocolo_pendente: 'Protocolo pendente',
  protocolo_feito: 'Protocolo feito',
  acompanhamento: 'Acompanhamento',
  concluido: 'Concluído',
}

export const ETAPA_EXECUCAO_BADGE: Record<EtapaExecucao, 'warning' | 'danger' | 'success' | 'info' | 'neutral'> = {
  gru_emitir: 'warning',
  gru_aguardando_pagamento: 'danger',
  protocolo_pendente: 'warning',
  protocolo_feito: 'success',
  acompanhamento: 'info',
  concluido: 'success',
}

/** Serviço com fluxo de execução mapeado nesta onda. */
export const SERVICO_COM_EXECUCAO = 'Registro de Marca'

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
  etapa_execucao: EtapaExecucao | null
  link_formulario_notion: string | null
  link_autentique: string | null
  link_grupo_whatsapp: string | null
  data_alocacao: string | null
  created_at: string
  etapa_macro_em: string
  etapa_execucao_em: string | null
  contrato: {
    id: string
    cliente: string
    valor: number
    data_fechamento: string
    responsavel_id: string | null
    servico: { id: string; nome: string } | null
    responsavel: { id: string; nome: string } | null
  }
  nucleo: { id: string; nome: string; slug: string } | null
  gestao_responsavel: { id: string; nome: string } | null
  gerente_nucleo: { id: string; nome: string } | null
  scrum_master: { id: string; nome: string } | null
  excecoes_abertas: number
}

const SELECT = `
  id, contrato_id, gestao_responsavel_id, nucleo_id, gerente_nucleo_id,
  assessores_projeto_ids, scrum_master_id, etapa_macro, etapa_execucao,
  link_formulario_notion, link_autentique, link_grupo_whatsapp,
  data_alocacao, created_at, etapa_macro_em, etapa_execucao_em,
  contrato:contratos!inner(
    id, cliente, valor, data_fechamento, responsavel_id,
    servico:project_services(id, nome),
    responsavel:people!contratos_responsavel_id_fkey(id, nome)
  ),
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
  etapa_execucao: EtapaExecucao | null
  gestao_responsavel_id: string | null
  nucleo_id: string | null
  gerente_nucleo_id: string | null
  assessores_projeto_ids: string[]
  scrum_master_id: string | null
  link_formulario_notion: string | null
  link_autentique: string | null
  link_grupo_whatsapp: string | null
  data_alocacao: string | null
}>

export async function atualizarEpeas(contratoId: string, patch: EpeasPatch) {
  const { error } = await supabase.from('epeas_lifecycle').update(patch).eq('contrato_id', contratoId)
  if (error) throw error
}

/** Avança para a etapa seguinte do fluxo macro. */
export async function avancarEtapa(contratoId: string, atual: EtapaMacro) {
  const i = ETAPAS_MACRO.indexOf(atual)
  const proxima = ETAPAS_MACRO[i + 1]
  if (!proxima) throw new Error('O contrato já está na última etapa.')

  const patch: EpeasPatch = { etapa_macro: proxima }
  // ao entrar em execução, começa pelo primeiro passo do fluxo do serviço
  if (proxima === 'projetos_em_execucao') patch.etapa_execucao = 'gru_emitir'
  await atualizarEpeas(contratoId, patch)
}

// ---------------------------------------------------------------------------
// Exceções
// ---------------------------------------------------------------------------

export interface Excecao {
  id: string
  contrato_id: string
  descricao: string
  status: 'aberto' | 'resolvido'
  created_at: string
  resolved_at: string | null
  aberto_por: { id: string; nome: string } | null
}

export async function getExcecoes(contratoId: string): Promise<Excecao[]> {
  const { data, error } = await supabase
    .from('epeas_contract_exceptions')
    .select('id, contrato_id, descricao, status, created_at, resolved_at, aberto_por:people!epeas_contract_exceptions_aberto_por_id_fkey(id, nome)')
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Excecao[]
}

export async function abrirExcecao(contratoId: string, descricao: string, pessoaId: string) {
  const { error } = await supabase
    .from('epeas_contract_exceptions')
    .insert({ contrato_id: contratoId, descricao, aberto_por_id: pessoaId })
  if (error) throw error
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

export interface HistoricoItem {
  id: string
  campo: 'etapa_macro' | 'etapa_execucao'
  etapa_anterior: string | null
  etapa_nova: string
  created_at: string
  alterado_por: { id: string; nome: string } | null
}

export async function getHistorico(contratoId: string): Promise<HistoricoItem[]> {
  const { data, error } = await supabase
    .from('epeas_contract_history')
    .select('id, campo, etapa_anterior, etapa_nova, created_at, alterado_por:people!epeas_contract_history_alterado_por_id_fkey(id, nome)')
    .eq('contrato_id', contratoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as HistoricoItem[]
}

/** Rótulo legível de qualquer etapa, macro ou de execução. */
export function rotuloEtapa(campo: string, valor: string | null): string {
  if (!valor) return '—'
  if (campo === 'etapa_macro') return ETAPA_MACRO_LABELS[valor as EtapaMacro] ?? valor
  return ETAPA_EXECUCAO_LABELS[valor as EtapaExecucao] ?? valor
}

/**
 * Alerta de pagamento parado (PRD §5): mais de 3 dias avisa, mais de 5 é crítico.
 * Só se aplica a "aguardando pagamento".
 */
export function alertaPagamento(c: EpeasContrato): { nivel: 'aviso' | 'critico'; dias: number } | null {
  if (c.etapa_execucao !== 'gru_aguardando_pagamento') return null
  const desde = c.etapa_execucao_em ?? c.created_at
  const dias = Math.floor((Date.now() - new Date(desde).getTime()) / 86_400_000)
  if (dias > 5) return { nivel: 'critico', dias }
  if (dias > 3) return { nivel: 'aviso', dias }
  return null
}

// ===========================================================================
// SLA por etapa — o que a lista de emojis do Telegram sinalizava
// ===========================================================================

/**
 * Dias tolerados em cada etapa antes de virar atraso.
 * Vem do processo real: assinatura e pagamento são os gargalos conhecidos.
 */
export const SLA_DIAS: Record<EtapaMacro, number> = {
  comercial_contrato_fechado: 2,
  comercial_formulario_enviado: 5,
  gestao_formulario_conferido: 2,
  gestao_assessor_definido: 2,
  gestao_contrato_elaboracao: 5,
  gestao_contrato_assinatura: 5,
  gestao_contrato_assinado: 2,
  projetos_aguardando_alocacao: 3,
  projetos_alocado: 2,
  projetos_grupo_criado: 2,
  projetos_em_execucao: 30,
  projetos_entregue: 9999,
}

export type Saude = 'ok' | 'atencao' | 'atrasado'

export interface StatusEtapa {
  dias: number
  sla: number
  saude: Saude
}

/** Há quantos dias o contrato está parado na etapa, e se isso já é atraso. */
export function statusEtapa(c: EpeasContrato): StatusEtapa {
  const desde = c.etapa_macro_em ?? c.created_at
  const dias = Math.floor((Date.now() - new Date(desde).getTime()) / 86_400_000)
  const sla = SLA_DIAS[c.etapa_macro]
  const saude: Saude = dias > sla ? 'atrasado' : dias >= sla - 1 ? 'atencao' : 'ok'
  return { dias, sla, saude }
}

// ===========================================================================
// Checklist por etapa — define o que é "pronto"
// ===========================================================================

export interface ItemChecklist {
  key: string
  label: string
  /** trava o avanço da etapa enquanto não estiver feito */
  obrigatorio: boolean
}

/**
 * O template vive no código porque muda com o processo, não com o dado.
 * Sem isso, "avançar etapa" é um botão sem contrato de significado — cada
 * pessoa decide sozinha o que considera pronto.
 */
export const CHECKLIST: Partial<Record<EtapaMacro, ItemChecklist[]>> = {
  comercial_contrato_fechado: [
    { key: 'dados_cliente', label: 'Dados do cliente conferidos', obrigatorio: true },
    { key: 'valor_servico', label: 'Valor e serviço confirmados com o cliente', obrigatorio: true },
  ],
  comercial_formulario_enviado: [
    { key: 'form_enviado', label: 'Formulário enviado ao cliente', obrigatorio: true },
    { key: 'form_link', label: 'Link do formulário registrado aqui', obrigatorio: true },
  ],
  gestao_formulario_conferido: [
    { key: 'form_preenchido', label: 'Cliente preencheu o formulário', obrigatorio: true },
    { key: 'dados_completos', label: 'Dados suficientes para redigir o contrato', obrigatorio: true },
  ],
  gestao_assessor_definido: [
    { key: 'assessor', label: 'Assessor de Gestão definido', obrigatorio: true },
  ],
  gestao_contrato_elaboracao: [
    { key: 'minuta', label: 'Minuta redigida', obrigatorio: true },
    { key: 'revisao', label: 'Revisada por segunda pessoa', obrigatorio: false },
  ],
  gestao_contrato_assinatura: [
    { key: 'autentique', label: 'Enviado pelo Autentique', obrigatorio: true },
    { key: 'link_autentique', label: 'Link do Autentique registrado aqui', obrigatorio: true },
  ],
  gestao_contrato_assinado: [
    { key: 'assinado_cliente', label: 'Cliente assinou', obrigatorio: true },
    { key: 'assinado_bev', label: 'Bevilaqua assinou', obrigatorio: true },
  ],
  projetos_aguardando_alocacao: [
    { key: 'nucleo', label: 'Núcleo escolhido', obrigatorio: true },
  ],
  projetos_alocado: [
    { key: 'time', label: 'Gerente e assessores definidos', obrigatorio: true },
    { key: 'kickoff', label: 'Kickoff combinado com o time', obrigatorio: false },
  ],
  projetos_grupo_criado: [
    { key: 'grupo', label: 'Grupo de WhatsApp criado com o cliente', obrigatorio: true },
    { key: 'grupo_link', label: 'Link do grupo registrado aqui', obrigatorio: true },
  ],
  projetos_em_execucao: [
    { key: 'entrega', label: 'Entregável enviado ao cliente', obrigatorio: true },
    { key: 'aceite', label: 'Cliente confirmou o recebimento', obrigatorio: false },
  ],
}

export interface ChecklistFeito {
  etapa: string
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

export async function marcarItem(contratoId: string, etapa: string, itemKey: string, pessoaId: string) {
  const { error } = await supabase
    .from('epeas_checklist_done')
    .insert({ contrato_id: contratoId, etapa, item_key: itemKey, feito_por: pessoaId })
  if (error) throw error
}

export async function desmarcarItem(contratoId: string, etapa: string, itemKey: string) {
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
  feitos: ChecklistFeito[],
): ItemChecklist[] {
  const itens = CHECKLIST[etapa] ?? []
  const marcados = new Set(feitos.filter((f) => f.etapa === etapa).map((f) => f.item_key))
  return itens.filter((i) => i.obrigatorio && !marcados.has(i.key))
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
