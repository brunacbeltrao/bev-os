/**
 * Informar o marco zero de vários contratos de uma vez.
 *
 * Os contratos migrados entraram sem nenhum evento, e sem assinatura
 * registrada não existe prazo jurídico possível — ficam todos "sem
 * baseline". Pedir que alguém abra 32 telas para digitar uma data é o tipo
 * de tarefa que não acontece, e a carteira ficaria para sempre sem prazo.
 *
 * A data de fechamento do contrato vem preenchida como sugestão, porque na
 * maioria dos casos é ela — mas é editável linha a linha, já que assinatura
 * e fechamento nem sempre coincidem.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useApp } from '@/lib/app-context'
import type { EpeasContrato } from '@/lib/epeas'
import * as P from '@/lib/epeas-prazos'

export function BaselineEmLote({
  contratos,
  ctx,
}: {
  contratos: EpeasContrato[]
  ctx: P.ContextoPrazos
}) {
  const { person } = useApp()
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)

  const semBaseline = useMemo(
    () => contratos.filter((c) => !P.temBaseline(c.contrato_id, ctx)),
    [contratos, ctx],
  )

  // A data de fechamento é só o palpite inicial; cada linha é editável.
  const [datas, setDatas] = useState<Record<string, string>>({})
  const dataDe = (c: EpeasContrato) =>
    datas[c.contrato_id] ?? c.contrato.data_fechamento.slice(0, 10)

  const mut = useMutation({
    mutationFn: () =>
      P.definirBaselineEmLote(
        semBaseline.map((c) => ({ contratoId: c.contrato_id, ocorridoEm: dataDe(c) })),
        person.id,
      ),
    onSuccess: () => {
      toast.success(`Baseline informado para ${semBaseline.length} contrato(s).`)
      setAberto(false)
      qc.invalidateQueries({ queryKey: ['epeas'] })
      qc.invalidateQueries({ queryKey: ['epeas-prazos'] })
    },
    onError: () => toast.error('Não foi possível informar o baseline.'),
  })

  if (semBaseline.length === 0) return null

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <CalendarCheck className="size-3.5" />
          Informar baseline ({semBaseline.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Informar a data de assinatura</DialogTitle>
          <DialogDescription>
            {semBaseline.length} contrato(s) não têm assinatura registrada, e por isso não têm
            prazo — não contam como atrasados. A data de fechamento vem sugerida; corrija onde
            assinatura e fechamento não coincidem.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          <ul className="flex flex-col divide-y">
            {semBaseline.map((c) => (
              <li key={c.contrato_id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {c.contrato.nome_comercial ?? c.contrato.cliente}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {c.contrato.servico?.nome ?? 'sem serviço'} · fechado em{' '}
                    {c.contrato.data_fechamento}
                  </span>
                </span>
                <input
                  type="date"
                  aria-label={`Data de assinatura de ${c.contrato.cliente}`}
                  className="border-input bg-card h-9 shrink-0 rounded-md border px-3 text-sm shadow-xs"
                  value={dataDe(c)}
                  onChange={(e) =>
                    setDatas((d) => ({ ...d, [c.contrato_id]: e.target.value }))
                  }
                />
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Gravando…' : `Confirmar ${semBaseline.length} contrato(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
