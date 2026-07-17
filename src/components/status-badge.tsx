/**
 * Badge de status transversal (Blueprint §8): paleta consistente
 * entre módulos — cinza (não iniciado), azul (em andamento),
 * amarelo (aguardando revisão/aprovação), verde (concluído),
 * vermelho (atrasado/rejeitado).
 */
import { Badge } from '@/components/ui/badge'
import { DEMAND_STATUS_LABELS, type DemandStatus } from '@/lib/demandas'

const STATUS_VARIANT: Record<DemandStatus, 'neutral' | 'info' | 'warning' | 'success'> = {
  a_fazer: 'neutral',
  em_andamento: 'info',
  em_revisao: 'warning',
  concluido: 'success',
}

export function DemandStatusBadge({
  status,
  atrasada,
}: {
  status: DemandStatus
  atrasada?: boolean
}) {
  if (atrasada && status !== 'concluido') {
    return <Badge variant="danger">Atrasada</Badge>
  }
  return <Badge variant={STATUS_VARIANT[status]}>{DEMAND_STATUS_LABELS[status]}</Badge>
}

export function isDemandAtrasada(prazo: string | null, status: DemandStatus): boolean {
  if (!prazo || status === 'concluido') return false
  return new Date(prazo + 'T23:59:59') < new Date()
}
