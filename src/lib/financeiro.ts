/** Financeiro (Onda 4 / ADD §3.11) — caixa único institucional.
 *
 *  · Todos leem o caixa; lideranças de Gestão lançam e ajustam o saldo.
 *  · Qualquer membro pode pedir reembolso (com comprovante) ou
 *    investimento; a decisão é das lideranças de Gestão.
 *  · Lançamentos são classificados por categoria e exportáveis em CSV.
 */
import { supabase } from './supabase'
import { z } from 'zod'

export type FinanceTipo = 'entrada' | 'saida'

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export type FinanceCategoria =
  | 'contrato'
  | 'faturamento_colaborativo'
  | 'patrocinio'
  | 'mensalidade'
  | 'evento'
  | 'reembolso'
  | 'investimento'
  | 'fornecedor'
  | 'material'
  | 'taxa_bancaria'
  | 'viagem'
  | 'marketing'
  | 'ajuste'
  | 'outros'

export const CATEGORIA_LABELS: Record<FinanceCategoria, string> = {
  contrato: 'Contrato',
  faturamento_colaborativo: 'Faturamento colaborativo',
  patrocinio: 'Patrocínio',
  mensalidade: 'Mensalidade',
  evento: 'Evento',
  reembolso: 'Reembolso',
  investimento: 'Investimento',
  fornecedor: 'Fornecedor',
  material: 'Material',
  taxa_bancaria: 'Taxa bancária',
  viagem: 'Viagem',
  marketing: 'Marketing',
  ajuste: 'Ajuste de saldo',
  outros: 'Outros',
}

/** Categorias que fazem sentido em cada tipo — evita lista gigante no form. */
export const CATEGORIAS_POR_TIPO: Record<FinanceTipo, FinanceCategoria[]> = {
  entrada: [
    'contrato',
    'faturamento_colaborativo',
    'patrocinio',
    'mensalidade',
    'evento',
    'ajuste',
    'outros',
  ],
  saida: [
    'fornecedor',
    'material',
    'evento',
    'viagem',
    'marketing',
    'reembolso',
    'investimento',
    'taxa_bancaria',
    'ajuste',
    'outros',
  ],
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------

export interface FinanceEntry {
  id: string
  tipo: FinanceTipo
  valor: number
  descricao: string
  data: string
  categoria: FinanceCategoria
  comprovante_path: string | null
  subarea_id: string | null
  cycle_id: string
  subarea?: { nome: string } | null
  responsavel?: { nome: string } | null
}

export interface FinanceSummary {
  entradas: number
  saidas: number
  saldo: number
}

export function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const FinanceEntrySchema = z.object({
  id: z.string(),
  tipo: z.enum(['entrada', 'saida']),
  valor: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  descricao: z.string(),
  data: z.string(),
  categoria: z.string().default('outros'),
  comprovante_path: z.string().nullable().optional().default(null),
  subarea_id: z.string().nullable(),
  cycle_id: z.string(),
  subarea: z.object({ nome: z.string() }).nullable().optional(),
  responsavel: z.object({ nome: z.string() }).nullable().optional(),
})

const ENTRY_SELECT =
  'id, tipo, valor, descricao, data, categoria, comprovante_path, subarea_id, cycle_id, subarea:subareas(nome), responsavel:people!finance_entries_aprovado_por_fkey(nome)'

export async function getFinanceEntries(cycleId: string): Promise<FinanceEntry[]> {
  const { data, error } = await supabase
    .from('finance_entries')
    .select(ENTRY_SELECT)
    .eq('cycle_id', cycleId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((e) => FinanceEntrySchema.parse(e)) as FinanceEntry[]
}

export function summarize(entries: FinanceEntry[], saldoInicial = 0): FinanceSummary {
  let entradas = 0
  let saidas = 0
  for (const e of entries) {
    if (e.tipo === 'entrada') entradas += e.valor
    else saidas += e.valor
  }
  return { entradas, saidas, saldo: saldoInicial + entradas - saidas }
}

/** Total por categoria, do maior para o menor — alimenta o resumo do painel. */
export function porCategoria(
  entries: FinanceEntry[],
  tipo: FinanceTipo,
): Array<{ categoria: FinanceCategoria; total: number; qtd: number }> {
  const mapa = new Map<FinanceCategoria, { total: number; qtd: number }>()
  for (const e of entries) {
    if (e.tipo !== tipo) continue
    const atual = mapa.get(e.categoria) ?? { total: 0, qtd: 0 }
    mapa.set(e.categoria, { total: atual.total + e.valor, qtd: atual.qtd + 1 })
  }
  return [...mapa.entries()]
    .map(([categoria, v]) => ({ categoria, ...v }))
    .sort((a, b) => b.total - a.total)
}

export interface NewFinanceEntry {
  tipo: FinanceTipo
  valor: number
  descricao: string
  data: string
  categoria: FinanceCategoria
  subarea_id: string | null
  comprovante_path?: string | null
  aprovado_por: string
}

export async function createFinanceEntry(input: NewFinanceEntry): Promise<string> {
  const { data, error } = await supabase
    .from('finance_entries')
    .insert({
      tipo: input.tipo,
      valor: input.valor,
      descricao: input.descricao,
      data: input.data,
      categoria: input.categoria,
      subarea_id: input.subarea_id,
      comprovante_path: input.comprovante_path ?? null,
      aprovado_por: input.aprovado_por,
      criado_por: input.aprovado_por,
    })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function deleteFinanceEntry(id: string): Promise<void> {
  const { error } = await supabase.from('finance_entries').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Saldo inicial do caixa (financeiro_meta)
// ---------------------------------------------------------------------------

export interface CaixaMeta {
  saldo_inicial: number
  reserva_minima: number
}

export async function getCaixaMeta(cycleId: string): Promise<CaixaMeta> {
  const { data, error } = await supabase
    .from('financeiro_meta')
    .select('saldo_inicial, reserva_minima')
    .eq('cycle_id', cycleId)
    .maybeSingle()
  if (error) throw error
  const row = data as { saldo_inicial: number; reserva_minima: number } | null
  return {
    saldo_inicial: Number(row?.saldo_inicial ?? 0),
    reserva_minima: Number(row?.reserva_minima ?? 0),
  }
}

export async function saveCaixaMeta(cycleId: string, patch: CaixaMeta): Promise<void> {
  const { error } = await supabase
    .from('financeiro_meta')
    .upsert({ cycle_id: cycleId, ...patch }, { onConflict: 'cycle_id' })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Solicitações de reembolso e investimento
// ---------------------------------------------------------------------------

export type RequestTipo = 'reembolso' | 'investimento'
export type RequestStatus = 'pendente' | 'aprovado' | 'rejeitado'

export const REQUEST_TIPO_LABELS: Record<RequestTipo, string> = {
  reembolso: 'Reembolso',
  investimento: 'Investimento',
}

export const REQUEST_BADGE: Record<RequestStatus, 'warning' | 'success' | 'danger'> = {
  pendente: 'warning',
  aprovado: 'success',
  rejeitado: 'danger',
}

export interface FinanceRequest {
  id: string
  cycle_id: string
  solicitante_id: string
  tipo: RequestTipo
  titulo: string
  descricao: string | null
  valor: number
  categoria: FinanceCategoria
  comprovante_path: string | null
  status: RequestStatus
  avaliado_por: string | null
  avaliado_em: string | null
  resposta: string | null
  finance_entry_id: string | null
  created_at: string
  solicitante?: { nome: string; foto_url: string | null } | null
  avaliador?: { nome: string } | null
}

const REQUEST_SELECT =
  '*, solicitante:people!finance_requests_solicitante_id_fkey(nome, foto_url), avaliador:people!finance_requests_avaliado_por_fkey(nome)'

export async function getFinanceRequests(cycleId: string): Promise<FinanceRequest[]> {
  const { data, error } = await supabase
    .from('finance_requests')
    .select(REQUEST_SELECT)
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    ...(r as unknown as FinanceRequest),
    valor: Number((r as { valor: number }).valor),
  }))
}

export interface NewFinanceRequest {
  cycle_id: string
  solicitante_id: string
  tipo: RequestTipo
  titulo: string
  descricao: string | null
  valor: number
  categoria: FinanceCategoria
  comprovante_path: string | null
}

export async function createFinanceRequest(input: NewFinanceRequest): Promise<void> {
  const { error } = await supabase.from('finance_requests').insert(input)
  if (error) throw error
}

export async function cancelFinanceRequest(id: string): Promise<void> {
  const { error } = await supabase.from('finance_requests').delete().eq('id', id)
  if (error) throw error
}

/**
 * Decisão da Gestão. Ao aprovar, opcionalmente já lança a saída no caixa
 * para não precisar redigitar o mesmo valor em dois lugares.
 */
export async function decideFinanceRequest(opts: {
  request: FinanceRequest
  status: Exclude<RequestStatus, 'pendente'>
  avaliadoPor: string
  resposta: string | null
  lancarNoCaixa: boolean
}): Promise<void> {
  const { request, status, avaliadoPor, resposta, lancarNoCaixa } = opts

  let entryId: string | null = null
  if (status === 'aprovado' && lancarNoCaixa) {
    entryId = await createFinanceEntry({
      tipo: 'saida',
      valor: request.valor,
      descricao: `${REQUEST_TIPO_LABELS[request.tipo]} · ${request.titulo}`,
      data: new Date().toISOString().slice(0, 10),
      categoria: request.tipo,
      subarea_id: null,
      comprovante_path: request.comprovante_path,
      aprovado_por: avaliadoPor,
    })
  }

  const { error } = await supabase
    .from('finance_requests')
    .update({
      status,
      avaliado_por: avaliadoPor,
      avaliado_em: new Date().toISOString(),
      resposta,
      finance_entry_id: entryId,
    })
    .eq('id', request.id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Comprovantes
// ---------------------------------------------------------------------------

/**
 * Sobe o comprovante para o bucket privado `financeiro` e devolve o
 * caminho do objeto — não uma URL.
 *
 * A primeira pasta do caminho é o id da pessoa, e é isso que a policy de
 * storage usa: cada um escreve e lê só a própria pasta, e a liderança de
 * Gestão (quem avalia o reembolso) lê todas. Comprovante tem dado
 * bancário e às vezes CPF, então não existe versão pública dele.
 */
export async function uploadComprovante(file: File, personId: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `${personId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from('financeiro')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  return path
}

/** URL temporária (60s) para abrir um comprovante do bucket privado. */
export async function urlComprovante(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('financeiro')
    .createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

function csvCell(v: string | number): string {
  const s = String(v ?? '')
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV com ponto-e-vírgula e vírgula decimal — abre direto no Excel pt-BR. */
export function entriesToCsv(entries: FinanceEntry[]): string {
  const header = [
    'Data',
    'Tipo',
    'Categoria',
    'Descrição',
    'Área',
    'Valor',
    'Responsável',
    'Comprovante',
  ]
  const linhas = entries.map((e) =>
    [
      new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR'),
      e.tipo === 'entrada' ? 'Entrada' : 'Saída',
      CATEGORIA_LABELS[e.categoria] ?? e.categoria,
      e.descricao,
      e.subarea?.nome ?? 'Geral',
      e.valor.toFixed(2).replace('.', ','),
      e.responsavel?.nome ?? '',
      e.comprovante_path ? 'sim' : '',
    ]
      .map(csvCell)
      .join(';'),
  )
  return [header.join(';'), ...linhas].join('\r\n')
}

export function baixarCsv(nome: string, conteudo: string): void {
  // BOM para o Excel reconhecer os acentos
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
