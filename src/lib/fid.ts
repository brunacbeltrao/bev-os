import { supabase } from './supabase'

export type TransactionType = 'credit' | 'debit'
export type TransactionStatus = 'pending' | 'approved' | 'rejected'

export interface BevCoinsTransaction {
  id: string
  person_id: string
  cycle_id: string
  type: TransactionType
  amount: number
  description: string
  status: TransactionStatus
  created_at: string
}

export interface RankingMember {
  person_id: string
  nome: string
  foto_url: string | null
  cycle_id: string
  total_earned: number
}

// ----------------------------------------------------------------------------
// Para todos os membros
// ----------------------------------------------------------------------------

export async function getMyWallet(cycle_id: string) {
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  const uid = userData.user.id

  // Busca extrato
  const { data: transactions, error: txErr } = await supabase
    .from('bevcoins_transactions')
    .select('*')
    .eq('person_id', uid)
    .eq('cycle_id', cycle_id)
    .order('created_at', { ascending: false })

  if (txErr) throw txErr

  // Calcula ganhos totais do ciclo (soma de creditos aprovados)
  const total_earned = transactions
    .filter((tx) => tx.type === 'credit' && tx.status === 'approved')
    .reduce((acc, curr) => acc + Number(curr.amount), 0)

  // Calcula débitos (pendentes e aprovados)
  const total_debits = transactions
    .filter((tx) => tx.type === 'debit' && (tx.status === 'approved' || tx.status === 'pending'))
    .reduce((acc, curr) => acc + Number(curr.amount), 0)

  // O saldo que aparece grande é: ganhos totais - débitos
  const available_balance = total_earned - total_debits

  return { transactions, available_balance, total_earned }
}

export async function getRanking(cycle_id: string) {
  const { data, error } = await supabase
    .from('bevcoins_ranking')
    .select('*')
    .eq('cycle_id', cycle_id)
    .order('total_earned', { ascending: false })

  if (error) throw error
  return data as RankingMember[]
}

export async function requestRedemption(cycle_id: string, amount: number, description: string) {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Não autenticado')

  const uid = userData.user.id

  const { error } = await supabase.from('bevcoins_transactions').insert({
    person_id: uid,
    cycle_id,
    type: 'debit',
    amount,
    description,
    status: 'pending',
  })

  if (error) throw error
}

// ----------------------------------------------------------------------------
// Somente Liderança/Direx
// ----------------------------------------------------------------------------

export async function getPendingRequests(cycle_id: string) {
  const { data, error } = await supabase
    .from('bevcoins_transactions')
    .select(`
      id,
      amount,
      description,
      status,
      created_at,
      people:person_id (
        id,
        nome,
        foto_url
      )
    `)
    .eq('cycle_id', cycle_id)
    .eq('type', 'debit')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function evaluateRequest(tx_id: string, new_status: 'approved' | 'rejected') {
  const { error } = await supabase
    .from('bevcoins_transactions')
    .update({ status: new_status })
    .eq('id', tx_id)

  if (error) throw error
}

export async function creditBevCoins(
  cycle_id: string,
  person_id: string,
  amount: number,
  description: string,
  contrato_id?: string | null,
) {
  const { error } = await supabase.from('bevcoins_transactions').insert({
    person_id,
    cycle_id,
    type: 'credit',
    amount,
    description,
    status: 'approved',
    contrato_id: contrato_id ?? null,
  })

  if (error) throw error
}

export interface ContratoParaCredito {
  id: string
  cliente: string
  valor: number
  data_fechamento: string
  /** quanto já foi creditado em BevCoins a partir deste contrato */
  ja_creditado: number
}

/**
 * Contratos aprovados do ciclo, com o quanto cada um já rendeu de BevCoins.
 *
 * O lançamento passa a partir daqui em vez de digitar o nome do contrato:
 * o valor vem do registro real e dá para ver o que já foi distribuído,
 * evitando creditar o mesmo contrato duas vezes sem perceber.
 */
export async function getContratosParaCredito(ano: number): Promise<ContratoParaCredito[]> {
  const [{ data: contratos, error: e1 }, { data: creditos, error: e2 }] = await Promise.all([
    supabase
      .from('contratos')
      .select('id, cliente, valor, data_fechamento')
      .eq('status', 'aprovado')
      .gte('data_fechamento', `${ano}-01-01`)
      .lte('data_fechamento', `${ano}-12-31`)
      .order('data_fechamento', { ascending: false }),
    supabase
      .from('bevcoins_transactions')
      .select('contrato_id, amount')
      .eq('type', 'credit')
      .not('contrato_id', 'is', null),
  ])

  if (e1) throw e1
  if (e2) throw e2

  const porContrato = new Map<string, number>()
  for (const c of creditos ?? []) {
    const id = (c as { contrato_id: string }).contrato_id
    porContrato.set(id, (porContrato.get(id) ?? 0) + Number((c as { amount: number }).amount))
  }

  return (contratos ?? []).map((c) => ({
    id: c.id as string,
    cliente: c.cliente as string,
    valor: Number(c.valor),
    data_fechamento: c.data_fechamento as string,
    ja_creditado: porContrato.get(c.id as string) ?? 0,
  }))
}

export interface LedgerTx {
  id: string
  type: TransactionType
  amount: number
  description: string
  status: TransactionStatus
  created_at: string
  people: { id: string; nome: string; foto_url: string | null } | null
}

/**
 * Extrato completo do ciclo — créditos e débitos, de todos os membros.
 *
 * Uma consulta só, porque a mesma lista alimenta duas leituras: o saldo
 * acumulado por pessoa e o histórico lançamento a lançamento. Buscar
 * separado abriria espaço para os dois números discordarem.
 */
export async function getCycleLedger(cycle_id: string) {
  const { data, error } = await supabase
    .from('bevcoins_transactions')
    .select(`id, type, amount, description, status, created_at,
      people:person_id ( id, nome, foto_url )`)
    .eq('cycle_id', cycle_id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as LedgerTx[]
}

export interface MemberBalance {
  person_id: string
  nome: string
  foto_url: string | null
  /** créditos aprovados */
  earned: number
  /** resgates já aprovados */
  spent: number
  /** resgates aguardando aval — já saem do disponível */
  pending: number
  /** earned - spent - pending */
  available: number
  creditos: LedgerTx[]
  resgates: LedgerTx[]
}

/**
 * Agrupa o extrato por pessoa. O saldo disponível desconta também os
 * resgates pendentes: o valor fica retido enquanto aguarda o aval, senão
 * a pessoa poderia solicitar duas vezes o mesmo saldo.
 */
export function buildBalances(txs: LedgerTx[]): MemberBalance[] {
  const mapa = new Map<string, MemberBalance>()

  for (const tx of txs) {
    const p = tx.people
    if (!p) continue
    let m = mapa.get(p.id)
    if (!m) {
      m = {
        person_id: p.id,
        nome: p.nome,
        foto_url: p.foto_url,
        earned: 0,
        spent: 0,
        pending: 0,
        available: 0,
        creditos: [],
        resgates: [],
      }
      mapa.set(p.id, m)
    }

    const valor = Number(tx.amount)
    if (tx.type === 'credit') {
      m.creditos.push(tx)
      if (tx.status === 'approved') m.earned += valor
    } else {
      m.resgates.push(tx)
      if (tx.status === 'approved') m.spent += valor
      else if (tx.status === 'pending') m.pending += valor
    }
  }

  const lista = [...mapa.values()]
  for (const m of lista) m.available = m.earned - m.spent - m.pending

  return lista.sort((a, b) => b.earned - a.earned || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Estorna um crédito lançado por engano. Só quem lança crédito consegue (RLS). */
export async function deleteCredit(tx_id: string) {
  const { error } = await supabase
    .from('bevcoins_transactions')
    .delete()
    .eq('id', tx_id)
    .eq('type', 'credit')

  if (error) throw error
}

/** Corrige valor/descrição de um crédito sem precisar estornar e relançar. */
export async function updateCredit(tx_id: string, amount: number, description: string) {
  const { error } = await supabase
    .from('bevcoins_transactions')
    .update({ amount, description })
    .eq('id', tx_id)
    .eq('type', 'credit')

  if (error) throw error
}

/**
 * Membros que podem receber crédito.
 *
 * Lê o vínculo do ciclo direto de `occupations` — como toda pessoa do
 * approved_roster é pré-provisionada no banco, os nomes aparecem aqui
 * mesmo antes de a pessoa criar a conta. Ficam de fora quem lança
 * crédito (lideranças de Negócios) e quem aprova (Diretor de Gestão).
 */
export interface EligibleMember {
  id: string
  nome: string
  area: string
  cargo: RoleType
}

export async function getEligibleMembers(cycle_id: string): Promise<EligibleMember[]> {
  const { data, error } = await supabase
    .from('occupations')
    .select(
      'role, is_hibrido, person:people!inner(id, nome, email), directorate:directorates!inner(slug, nome), subarea:subareas!inner(nome)',
    )
    .eq('cycle_id', cycle_id)
    .eq('is_hibrido', false)

  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    role: RoleType
    person: { id: string; nome: string; email: string }
    directorate: { slug: string; nome: string }
    subarea: { nome: string }
  }>

  const LIDERANCA = ['diretor', 'gerente', 'coordenador']

  return rows
    .filter((r) => {
      const lancaCredito = r.directorate.slug === 'negocios' && LIDERANCA.includes(r.role)
      const aprovaResgate = r.directorate.slug === 'gestao' && r.role === 'diretor'
      return !lancaCredito && !aprovaResgate
    })
    .map((r) => ({
      id: r.person.id,
      nome: r.person.nome,
      area: r.role === 'diretor' ? r.directorate.nome : r.subarea.nome,
      cargo: r.role,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export type RoleType = 'diretor' | 'gerente' | 'coordenador' | 'analista' | 'assessor'

export const CARGO_LABELS: Record<RoleType, string> = {
  diretor: 'Diretor(a)',
  gerente: 'Gerente',
  coordenador: 'Coordenador(a)',
  analista: 'Analista',
  assessor: 'Assessor(a)',
}
