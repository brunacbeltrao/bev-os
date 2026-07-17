/**
 * Barra de aprovação transversal (Blueprint §8): toda ação de
 * aprovar/reprovar (demandas e, nas próximas ondas, financeiro e
 * PDI) usa este mesmo componente, no topo do painel de detalhe —
 * botões sempre no mesmo lugar visual.
 */
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ApprovalBar({
  titulo,
  onAprovar,
  onReprovar,
  disabled,
}: {
  titulo: string
  onAprovar: () => void
  onReprovar: () => void
  disabled?: boolean
}) {
  return (
    <div className="bg-status-warning-bg flex items-center gap-3 rounded-md border p-3">
      <span className="text-status-warning flex-1 text-sm font-medium">{titulo}</span>
      <Button size="sm" variant="outline" onClick={onReprovar} disabled={disabled}>
        <X className="size-4" />
        Reprovar
      </Button>
      <Button size="sm" onClick={onAprovar} disabled={disabled}>
        <Check className="size-4" />
        Aprovar
      </Button>
    </div>
  )
}
