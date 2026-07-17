import { supabase } from './supabase'

export interface Oto {
  id: string
  directorate_id: string
  subarea_id: string
  cycle_id: string
  titulo: string
  descricao: string | null
  prazo: string | null
  status: 'pendente' | 'em_andamento' | 'concluido' | 'cancelado'
  created_at: string
  subarea?: { nome: string }
  directorate?: { nome: string }
}

export interface OneOnOne {
  id: string
  gerente_id: string
  liderado_id: string
  cycle_id: string
  data_reuniao: string
  relatorio: string | null
  acoes: string | null
  insights: string | null
  pretensao_lideranca: string | null
  dificuldades: string | null
  created_at: string
  liderado?: { nome: string; email: string }
  gerente?: { nome: string }
}

export async function getOtos(cycleId: string, subareaId?: string, directorateId?: string) {
  let query = supabase
    .from('otos')
    .select('*, subarea:subareas(nome), directorate:directorates(nome)')
    .eq('cycle_id', cycleId)

  if (subareaId) {
    query = query.eq('subarea_id', subareaId)
  }
  if (directorateId) {
    query = query.eq('directorate_id', directorateId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data as Oto[]
}

export async function createOto(oto: Omit<Oto, 'id' | 'created_at' | 'subarea' | 'directorate'>) {
  const { data, error } = await supabase
    .from('otos')
    .insert([oto])
    .select()
    .single()
  if (error) throw error
  return data as Oto
}

export async function updateOtoStatus(id: string, status: Oto['status']) {
  // updated_at agora é mantido pelo trigger otos_updated_at no banco
  const { data, error } = await supabase
    .from('otos')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Oto
}

export async function getOneOnOnes(cycleId: string, gerenteId?: string) {
  let query = supabase
    .from('one_on_ones')
    .select('*, liderado:people!liderado_id(nome, email), gerente:people!gerente_id(nome)')
    .eq('cycle_id', cycleId)

  if (gerenteId) {
    query = query.eq('gerente_id', gerenteId)
  }

  const { data, error } = await query.order('data_reuniao', { ascending: false })
  if (error) throw error
  return data as OneOnOne[]
}

export async function createOneOnOne(oneOnOne: Omit<OneOnOne, 'id' | 'created_at' | 'liderado' | 'gerente'>) {
  const { data, error } = await supabase
    .from('one_on_ones')
    .insert([oneOnOne])
    .select()
    .single()
  if (error) throw error
  return data as OneOnOne
}
