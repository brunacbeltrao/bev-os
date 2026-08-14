import { supabase } from '@/lib/supabase'

export async function checkEventSubarea(
  subareaId: string | null,
  meetingTypeSlug: string
) {
  const isInstitucional = ['rg', 'rd', 'rl'].includes(meetingTypeSlug)
  if (isInstitucional && subareaId) {
    throw new Error('BEV_OS_EVENTO_SUBAREA_INDEVIDA: Eventos institucionais (RG/RD/RL) não devem ter subárea vinculada.')
  }
}

export async function checkOccupationHybridRole(
  role: string,
  isHibrido: boolean
) {
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .eq('key', 'allow_hybrid_managers')
    .single()

  const allowHybridManagers = settings?.value === 'true'

  if (isHibrido) {
    if (!allowHybridManagers && role !== 'assessor') {
      throw new Error('BEV_OS_HIBRIDO_INVALIDO: Apenas assessores podem ter vínculo híbrido com as regras atuais.')
    }
  }
}

export async function checkDemandLeadership(
  role: string,
  newStatus: string
) {
  // Conforme Art. 14 e Art. 15 do Regimento Interno, apenas Coordenadores, Gerentes e Diretores 
  // formam a Liderança, aptos a concluir demandas, caso a regra de sistema esteja ativa.
  if (newStatus !== 'concluido') return

  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .eq('key', 'only_leaders_can_complete_demands')
    .single()

  const onlyLeaders = settings?.value === 'true'

  if (onlyLeaders) {
    const isLeadership = ['diretor', 'gerente', 'coordenador'].includes(role)
    if (!isLeadership) {
      throw new Error('BEV_OS_DEMANDA_LIDERANCA: Apenas membros da liderança podem concluir demandas.')
    }
  }
}
