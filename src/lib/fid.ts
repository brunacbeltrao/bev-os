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

export async function creditBevCoins(cycle_id: string, person_id: string, amount: number, description: string) {
  const { error } = await supabase.from('bevcoins_transactions').insert({
    person_id,
    cycle_id,
    type: 'credit',
    amount,
    description,
    status: 'approved',
  })

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
